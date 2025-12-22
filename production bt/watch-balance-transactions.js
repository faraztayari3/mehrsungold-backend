const path = require('path');
const dotenv = require('dotenv');

// Load env from bt-mailer/.env, and also try parent .env
dotenv.config({ path: path.join(__dirname, '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });

const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
const Kavenegar = require('kavenegar');
const fs = require('fs');

let jalaliMoment = null;
try {
  // Optional dependency (available in the main backend in many deployments).
  // If not present, we fall back to the original date values.
  jalaliMoment = require('jalali-moment');
} catch {}

function getEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return fallback;
  const trimmed = String(raw).trim();
  return trimmed === '' ? fallback : trimmed;
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  const v = String(value).trim().toLowerCase();
  if (v === '') return fallback;
  if (['1', 'true', 'yes', 'y', 'on', 'enable', 'enabled'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disable', 'disabled'].includes(v)) return false;
  return fallback;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const MONGODB_URI = getEnv('MONGODB_URI') || getEnv('MONGO_URI') || getEnv('DATABASE_URI');
const MONGODB_DB = getEnv('MONGODB_DB');
const MONGODB_COLLECTION = getEnv('MONGODB_COLLECTION');

const SMTP_HOST = getEnv('SMTP_HOST');
const SMTP_PORT = getEnv('SMTP_PORT');
const SMTP_USER = getEnv('SMTP_USER');
const SMTP_PASS = getEnv('SMTP_PASS');
const SMTP_FROM = getEnv('SMTP_FROM');
const ALERT_TO = getEnv('ALERT_TO');

const KAVENEGAR_API_KEY = getEnv('KAVENEGAR_API_KEY');
const KAVENEGAR_SENDER = getEnv('KAVENEGAR_SENDER');
const KAVENEGAR_RECEPTOR = getEnv('KAVENEGAR_RECEPTOR');

const isTestMode = process.argv.includes('--test');

// ---------- sms safety ----------
// Modes:
// - off:      never send SMS (default)
// - dry-run:  log what would be sent
// - live:     actually send (requires SMS_ALLOW_LIVE=true)
const SMS_MODE_RAW = String(getEnv('SMS_MODE', isTestMode ? 'dry-run' : 'off')).trim().toLowerCase();
const SMS_MODE = ['off', 'dry-run', 'dryrun', 'live'].includes(SMS_MODE_RAW)
  ? (SMS_MODE_RAW === 'dryrun' ? 'dry-run' : SMS_MODE_RAW)
  : (isTestMode ? 'dry-run' : 'off');

const SMS_ALLOW_LIVE = parseBool(getEnv('SMS_ALLOW_LIVE'), false);
const SMS_ALLOW_NON_PROD = parseBool(getEnv('SMS_ALLOW_NON_PROD'), false);
const SMS_TEST_CAN_SEND = parseBool(getEnv('SMS_TEST_CAN_SEND'), false);
const SMS_MAX_PER_MINUTE = Number(getEnv('SMS_MAX_PER_MINUTE', '0')) || 0;
const smsSendTimestamps = [];

// If true, do NOT resume from stored change-stream tokens (prevents processing "old" events after downtime).
const WATCH_START_FRESH = parseBool(getEnv('WATCH_START_FRESH'), false);

function isProductionEnv() {
  return String(getEnv('NODE_ENV', '')).trim().toLowerCase() === 'production';
}

function canSendSmsLive() {
  if (SMS_MODE !== 'live') return false;
  if (!SMS_ALLOW_LIVE) return false;
  if (!isProductionEnv() && !SMS_ALLOW_NON_PROD) return false;
  if (isTestMode && !SMS_TEST_CAN_SEND) return false;
  return true;
}

function rateLimitAllowsSend() {
  if (!SMS_MAX_PER_MINUTE) return true;
  const now = Date.now();
  const windowMs = 60_000;
  while (smsSendTimestamps.length && now - smsSendTimestamps[0] > windowMs) smsSendTimestamps.shift();
  if (smsSendTimestamps.length >= SMS_MAX_PER_MINUTE) return false;
  smsSendTimestamps.push(now);
  return true;
}

if (!isTestMode && (!MONGODB_URI || !MONGODB_DB || !MONGODB_COLLECTION)) {
  console.error('Missing Mongo envs. Set MONGODB_URI (or MONGO_URI/DATABASE_URI), MONGODB_DB, MONGODB_COLLECTION.');
  process.exit(1);
}

// ---------- sms (kavenegar) ----------
const smsSender = (KAVENEGAR_SENDER || '20006000646').trim();
const smsReceptors = splitCsv(KAVENEGAR_RECEPTOR || '09120315101');

const kavenegarApi = KAVENEGAR_API_KEY
  ? Kavenegar.KavenegarApi({ apikey: KAVENEGAR_API_KEY.trim() })
  : null;

// ---------- email ----------
const hasEmailConfig = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && ALERT_TO);
const transporter = hasEmailConfig
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

console.log(
  `bt-mailer config: email=${transporter ? 'enabled' : 'disabled'} sms=${kavenegarApi ? 'enabled' : 'disabled'} receptors=${smsReceptors.length}`
);

function normalizeDigitsToAscii(str) {
  return String(str)
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0)) // Persian digits
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)); // Arabic-Indic digits
}

function formatThousands(value) {
  if (value === null || value === undefined) return '-';
  const normalized = normalizeDigitsToAscii(String(value).trim()).replace(/,/g, '');
  if (normalized === '') return '-';

  // Keep string-based formatting to preserve decimals/trailing zeros.
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return String(value);

  const sign = match[1] || '';
  const intPart = match[2];
  const fracPart = match[3];
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + groupedInt + (fracPart ? `.${fracPart}` : '');
}

function formatJalaliDate(value) {
  if (!value) return '-';
  if (!jalaliMoment) return String(value);

  try {
    const iso = value instanceof Date ? value.toISOString() : String(value);
    const m = jalaliMoment(iso);
    if (!m || typeof m.isValid !== 'function' || !m.isValid()) return String(value);
    return m.locale('fa').format('YYYY-MM-DD HH:mm:ss');
  } catch {
    return String(value);
  }
}

function formatJalaliDateTimeParts(value) {
  if (!value) return { date: '', time: '' };

  // Best effort fallback when jalali-moment isn't available.
  if (!jalaliMoment) {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return { date: String(value), time: '' };
    const iso = d.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  }

  try {
    const iso = value instanceof Date ? value.toISOString() : String(value);
    const m = jalaliMoment(iso);
    if (!m || typeof m.isValid !== 'function' || !m.isValid()) return { date: String(value), time: '' };
    return {
      date: m.locale('fa').format('jYYYY/jM/jD'),
      time: m.locale('fa').format('HH:mm'),
    };
  } catch {
    return { date: String(value), time: '' };
  }
}

function unwrapMongoNumber(value) {
  if (value && typeof value === 'object') {
    if (value.$numberDecimal) return value.$numberDecimal;
    if (value.$numberLong) return value.$numberLong;
    if (value.$numberInt) return value.$numberInt;
    if (value.$numberDouble) return value.$numberDouble;
    if (value._bsontype && typeof value.toString === 'function') return value.toString();
  }
  return value;
}

function pickFirstPresent(doc, keys) {
  for (const key of keys) {
    if (!doc) continue;
    if (!Object.prototype.hasOwnProperty.call(doc, key)) continue;
    const value = unwrapMongoNumber(doc[key]);
    if (value === null || value === undefined) continue;
    const str = String(value).trim();
    if (str === '') continue;
    return value;
  }
  return undefined;
}

function userLabel(user) {
  if (!user) return '-';
  const name = `${user.firstName || '-'} ${user.lastName || '-'}`.trim().replace(/\s+/g, ' ');
  return name === '- -' ? (user.mobileNumber || '-') : name;
}

function mapTxnType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (['buy', 'purchase'].includes(t)) return 'خرید';
  if (['sell'].includes(t)) return 'فروش';
  return type || '-';
}

function mapStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return '-';
  if (['accepted', 'accept', 'approved', 'success', 'successful', 'done', 'completed', 'complete', 'confirmed'].includes(s)) return 'تایید';
  if (['rejected', 'reject', 'failed', 'failure', 'canceled', 'cancelled', 'declined'].includes(s)) return 'رد';
  if (['pending', 'waiting', 'inprogress', 'in_progress', 'processing'].includes(s)) return 'در انتظار';
  return status;
}

function mapTradeableLabel(tradeable) {
  const raw = String(tradeable || '').trim();
  const t = raw.toLowerCase();
  if (!t) return '-';
  if (t.includes('usdt') || t.includes('tether') || raw.includes('تتر')) return 'تتر';
  if (t.includes('gold') || t.includes('xau') || raw.includes('طلا')) return 'طلا';
  if (t.includes('silver') || t.includes('xag') || raw.includes('نقره')) return 'نقره';
  return raw;
}

function mapTradeableUnit(tradeableLabel) {
  const t = String(tradeableLabel || '').trim();
  if (t === 'طلا' || t === 'نقره') return 'گرم';
  if (t === 'تتر') return 'واحد';
  return 'واحد';
}

function mapBalanceTxType(type) {
  const raw = String(type || '').trim();
  const t = raw.toLowerCase();
  if (!t) return '-';
  if (t.includes('offlinedeposit') || t.includes('offline_deposit') || raw.includes('واریز دستی')) return 'واریز دستی';
  if (t.includes('onlinedeposit') || t.includes('online_deposit') || t.includes('iddeposit')) return 'واریز';
  if (t.includes('withdraw')) return 'برداشت';
  return raw;
}

function statusPhrase(status) {
  const s = mapStatus(status);
  if (s === 'تایید') return 'تایید شد';
  if (s === 'رد') return 'رد شد';
  if (s === 'در انتظار') return 'در انتظار است';
  if (!s || s === '-') return '';
  return `${s} است`;
}

function buildSmsText(kind, doc, user) {
  if (!doc || typeof doc !== 'object') return '-';

  if (kind === 'transaction') {
    const type = mapTxnType(doc.type);
    const tradeableRaw = doc.tradeableName ?? doc.tradeable ?? '-';
    const tradeable = mapTradeableLabel(tradeableRaw);
    const unit = mapTradeableUnit(tradeable);

    // In transactions, `amount` is usually the tradeable amount (e.g. grams for gold/silver).
    const amountValue = pickFirstPresent(doc, ['amount', 'tradeableAmount', 'quantity', 'qty', 'Amount']);
    const amount = formatThousands(amountValue);

    // `total` is usually the payable total in currency.
    const totalValue = pickFirstPresent(doc, ['total', 'price', 'value', 'Total', 'Payable', 'payable']);
    const total = formatThousands(totalValue);

    const phrase = statusPhrase(doc.status);
    return `${type} ${amount} ${unit} ${tradeable} به مبلغ ${total} توسط ${userLabel(user)} ${phrase}`.replace(/\s+/g, ' ').trim();
  }

  // balanceTx
  const amountValue = pickFirstPresent(doc, ['amount', 'total', 'value', 'Amount', 'Total']);
  const amount = formatThousands(amountValue);
  const type = mapBalanceTxType(doc.type);

  // Dedicated template for offline/manual deposits
  if (type === 'واریز دستی') {
    const accountName = userLabel(user);
    const remaining = user && user.tomanBalance !== undefined && user.tomanBalance !== null
      ? `${formatThousands(unwrapMongoNumber(user.tomanBalance))}`
      : '';
    const when = doc.updatedAt ?? doc.createdAt;
    const { date, time } = formatJalaliDateTimeParts(when);

    return [
      'مهرسان گلد',
      `واريز مبلغ ${amount} تومان`,
      `به حساب ${accountName}`,
      remaining ? `مانده حساب: ${remaining} تومان` : '',
      date,
      time,
    ].filter(Boolean).join('\n');
  }

  const phrase = statusPhrase(doc.status);
  return `${type} مبلغ ${amount} توسط ${userLabel(user)} ${phrase}`.replace(/\s+/g, ' ').trim();
}

function buildNotificationBody(docOrBodyText, user) {
  const userDetails = user ? `User: ${user.firstName || '-'} ${user.lastName || '-'} (${user.mobileNumber || '-'})` : '';

  if (typeof docOrBodyText === 'string') {
    return [docOrBodyText, userDetails].filter(Boolean).join('\n');
  }

  const doc = docOrBodyText || {};
  return [
    `Type: ${doc.type ?? '-'}`,
    `Amount: ${formatThousands(unwrapMongoNumber(doc.amount))}`,
    `Wage: ${formatThousands(unwrapMongoNumber(doc.wage))}`,
    `Total: ${formatThousands(unwrapMongoNumber(doc.total))}`,
    `TradeablePrice: ${formatThousands(doc.tradeablePrice)}`,
    `Tradeable: ${doc.tradeableName ?? doc.tradeable ?? '-'}`,
    `Status: ${doc.status ?? '-'}`,
    `CreatedAt: ${doc.jalaliDate ?? formatJalaliDate(doc.createdAt)}`,
    `UpdatedAt: ${formatJalaliDate(doc.updatedAt)}`,
    `ConfirmDescription: ${doc.confirmDescription ?? '-'}`,
    `_id: ${doc._id}`,
    userDetails,
  ].join('\n');
}

async function sendSms(kind, docOrBodyText, user) {
  if (!kavenegarApi) {
    console.warn('SMS skipped: missing KAVENEGAR_API_KEY');
    return;
  }
  if (!smsReceptors.length) {
    console.warn('SMS skipped: no receptors (set KAVENEGAR_RECEPTOR)');
    return;
  }

  const message = typeof docOrBodyText === 'string'
    ? docOrBodyText
    : buildSmsText(kind, docOrBodyText, user);

  if (SMS_MODE === 'off') {
    console.log('[SMS off] Skipped admin SMS. Would send to:', smsReceptors.join(','));
    return;
  }
  if (SMS_MODE === 'dry-run') {
    console.log('[SMS dry-run] Admin SMS. To:', smsReceptors.join(','));
    console.log(message);
    return;
  }
  if (!canSendSmsLive()) {
    console.warn('[SMS blocked] Admin SMS blocked. Set SMS_MODE=live and SMS_ALLOW_LIVE=true (and NODE_ENV=production).');
    return;
  }
  if (!rateLimitAllowsSend()) {
    console.error('[SMS blocked] Rate limit reached for admin SMS.');
    return;
  }

  try {
    await new Promise((resolve, reject) => {
      kavenegarApi.Send(
        {
          message,
          sender: smsSender,
          receptor: smsReceptors.join(','),
        },
        (response, status) => {
          // Kavenegar returns status 200 on success (per their docs); keep it lenient.
          if (status && Number(status) >= 200 && Number(status) < 300) return resolve(response);
          return reject(new Error(`Kavenegar status: ${status}`));
        }
      );
    });
    console.log('SMS sent:', message);
  } catch (e) {
    console.error('SMS failed:', e?.message || e);
  }
}

// Function to send the email with both transaction and user details
async function sendEmail(subject, docOrBodyText, user) {
  if (!transporter) {
    console.warn('Email skipped: missing SMTP envs (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/ALERT_TO)');
    return;
  }
  const body = buildNotificationBody(docOrBodyText, user);

  try {
    await transporter.sendMail({
      from: SMTP_FROM || '"Notifier" <no-reply@example.com>',
      to: splitCsv(ALERT_TO).join(','),
      subject,
      text: body,
    });
    console.log('Email sent:', subject);
  } catch (e) {
    console.error('Email failed:', e?.message || e);
  }
}

// ---------- resume token helpers (per-collection) ----------
const tokenPath = (name) => path.join(__dirname, `resume-token-${name}.json`);
function loadToken(name) {
  try { return JSON.parse(fs.readFileSync(tokenPath(name), 'utf8')); }
  catch { return undefined; }
}
function saveToken(name, token) {
  if (!token) return;
  fs.writeFileSync(tokenPath(name), JSON.stringify(token));
}
function wipeToken(name) {
  try { fs.unlinkSync(tokenPath(name)); } catch {}
}

// ---------- main ----------
async function main() {
  if (isTestMode) {
    const subject = 'Test Notification — bt-mailer';
    const sampleDoc = {
      type: 'test',
      amount: 1234567,
      wage: 0,
      total: 1234567,
      tradeablePrice: 987654321,
      tradeableName: 'TEST',
      status: 'ok',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confirmDescription: 'server test',
      _id: 'server-test',
    };
    const sampleUser = { firstName: 'Server', lastName: 'Test', mobileNumber: '09120000000' };

    await sendEmail(subject, sampleDoc, sampleUser);
    await sendSms('transaction', sampleDoc, sampleUser);
    await sendSms('balanceTx', sampleDoc, sampleUser);
    console.log('Test mode done.');
    return;
  }

  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(MONGODB_DB);

  const collTx = db.collection(MONGODB_COLLECTION);  // balancetransactions
  const collUsers = db.collection('users');
  const collTransactions = db.collection('transactions');  // New addition

  const pipelineTx = [{ $match: { operationType: { $in: ['insert','update'] } } }];
  const pipelineUsers = [{ $match: { operationType: { $in: ['insert'] } } }];
  const pipelineTransactions = [{ $match: { operationType: { $in: ['insert','update'] } } }];  // New addition

  let txStream, usersStream, transactionsStream;

  // Stream for balance transactions
  const startTxStream = () => {
    txStream?.close();
    const resume = WATCH_START_FRESH ? undefined : loadToken('tx');
    const opts = { fullDocument: 'updateLookup', ...(resume ? { startAfter: resume } : {}) };
    txStream = collTx.watch(pipelineTx, opts);

    txStream.on('change', async (ev) => {
      const doc = ev.fullDocument || {};
      const updated = ev.updateDescription?.updatedFields || {};
      const statusChanged = Object.prototype.hasOwnProperty.call(updated, 'status');
      if (ev.operationType === 'update' && !statusChanged) return;

      const user = await collUsers.findOne({ _id: doc.user }); // Get user details from users collection

      const subject = ev.operationType === 'insert'
        ? `New BalanceTx — ${doc.type || ''} ${doc.amount || ''}`
        : `BalanceTx status → ${doc.status || ''} — ${doc.type || ''} ${doc.amount || ''}`;

      await sendEmail(subject, doc, user); // Send email with both transaction and user details
      await sendSms('balanceTx', doc, user);
      saveToken('tx', txStream.resumeToken);
    });

    txStream.on('error', (err) => {
      console.error('Tx stream error:', err?.errmsg || err?.message || err);
      if (String(err).includes('resume token was not found')) wipeToken('tx');
      setTimeout(startTxStream, 1500); // Restart stream
    });

    console.log(`Watching ${MONGODB_DB}.${MONGODB_COLLECTION} ...`);
  };

  // Stream for users
  const startUsersStream = () => {
    usersStream?.close();
    const resume = WATCH_START_FRESH ? undefined : loadToken('users');
    const opts = { fullDocument: 'updateLookup', ...(resume ? { startAfter: resume } : {}) };
    usersStream = collUsers.watch(pipelineUsers, opts);

    usersStream.on('change', async (ev) => {
      if (ev.operationType !== 'insert') return;
      const doc = ev.fullDocument || {};
      const user = await collUsers.findOne({ _id: doc._id });

      const subject = `New User — ${doc.firstName || ''} ${doc.lastName || ''} (${doc.mobileNumber || ''})`;
      const body = [
        `Name: ${doc.firstName || ''} ${doc.lastName || ''}`,
        `Mobile: ${doc.mobileNumber || '-'}`,
        `Role: ${doc.role || '-'}`,
        `VerificationStatus: ${doc.verificationStatus || '-'}`,
        `CreatedAt: ${doc.createdAt || '-'}`,
        `_id: ${doc._id}`,
      ].join('\n');

      await sendEmail(subject, body, user); // Send email with user details
      saveToken('users', usersStream.resumeToken);
    });

    usersStream.on('error', (err) => {
      console.error('Users stream error:', err?.errmsg || err?.message || err);
      if (String(err).includes('resume token was not found')) wipeToken('users');
      setTimeout(startUsersStream, 1500);
    });

    console.log(`Watching ${MONGODB_DB}.users ...`);
  };

  // Stream for transactions
  const startTransactionsStream = () => {
    transactionsStream?.close();
    const resume = WATCH_START_FRESH ? undefined : loadToken('transactions');
    const opts = { fullDocument: 'updateLookup', ...(resume ? { startAfter: resume } : {}) };
    transactionsStream = collTransactions.watch(pipelineTransactions, opts);

    transactionsStream.on('change', async (ev) => {
      const doc = ev.fullDocument || {};
      const updated = ev.updateDescription?.updatedFields || {};
      const statusChanged = Object.prototype.hasOwnProperty.call(updated, 'status');
      if (ev.operationType === 'update' && !statusChanged) return;

      const user = await collUsers.findOne({ _id: doc.user }); // Fetch user info
      
      // Fetch tradeable info
      const collTradeables = db.collection('tradeables');
      const tradeable = doc.tradeable ? await collTradeables.findOne({ _id: doc.tradeable }) : null;
      const tradeableName = tradeable ? (tradeable.name || tradeable.symbol || 'Unknown') : '-';

      const subject = `New Transaction — ${doc.type || ''} ${doc.amount || ''} ${tradeableName} (${doc.status || ''})`;
      
      // Create custom doc with tradeable name
      const enrichedDoc = {
        ...doc,
        tradeableName: tradeableName,
      };
      
      await sendEmail(subject, enrichedDoc, user); // Send email with transaction, user and tradeable details
      await sendSms('transaction', enrichedDoc, user);
      saveToken('transactions', transactionsStream.resumeToken);
    });

    transactionsStream.on('error', (err) => {
      console.error('Transactions stream error:', err?.errmsg || err?.message || err);
      if (String(err).includes('resume token was not found')) wipeToken('transactions');
      setTimeout(startTransactionsStream, 1500);
    });

    console.log(`Watching ${MONGODB_DB}.transactions ...`);
  };

  // start all streams
  if (WATCH_START_FRESH) {
    wipeToken('tx');
    wipeToken('users');
    wipeToken('transactions');
    console.log('bt-mailer: WATCH_START_FRESH enabled (ignoring resume tokens)');
  }
  startTxStream();
  startUsersStream();
  startTransactionsStream();
}

main().catch((err) => {
  console.error('Fatal:', err?.message || err);
  process.exit(2);
});