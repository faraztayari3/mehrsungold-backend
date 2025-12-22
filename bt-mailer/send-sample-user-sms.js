#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');

// Load env from bt-mailer/.env and backend root .env
dotenv.config({ path: path.join(__dirname, '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });

const { MongoClient, ObjectId } = require('mongodb');
const Kavenegar = require('kavenegar');

let jalaliMoment = null;
try {
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

function normalizeDigitsToAscii(str) {
  return String(str)
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function formatThousands(value) {
  if (value === null || value === undefined) return '-';
  const normalized = normalizeDigitsToAscii(String(value).trim()).replace(/,/g, '');
  if (normalized === '') return '-';
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return String(value);
  const sign = match[1] || '';
  const intPart = match[2];
  const fracPart = match[3];
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + groupedInt + (fracPart ? `.${fracPart}` : '');
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

function parseArgs(argv) {
  const out = { dryRun: true, to: '', limit: 12 };
  for (const a of argv.slice(2)) {
    if (a === '--send') out.dryRun = false;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--to=')) out.to = a.slice('--to='.length);
    else if (a.startsWith('--limit=')) out.limit = Number(a.slice('--limit='.length)) || out.limit;
  }
  return out;
}

function isProductionEnv() {
  return String(getEnv('NODE_ENV', '')).trim().toLowerCase() === 'production';
}

const MONGODB_URI = getEnv('MONGODB_URI') || getEnv('MONGO_URI') || getEnv('DATABASE_URI');
const MONGODB_DB = getEnv('MONGODB_DB');

const KAVENEGAR_API_KEY = getEnv('KAVENEGAR_API_KEY');
const KAVENEGAR_SENDER = getEnv('KAVENEGAR_SENDER', '20006000646');

// Safety: live send requires BOTH env flags and an explicit --send.
const SMS_MODE = String(getEnv('SMS_MODE', 'off')).trim().toLowerCase();
const SMS_ALLOW_LIVE = parseBool(getEnv('SMS_ALLOW_LIVE'), false);
const SAMPLES_CAN_SEND = parseBool(getEnv('SAMPLES_CAN_SEND'), false);

const args = parseArgs(process.argv);

const TO_NUMBER = normalizeDigitsToAscii(args.to || getEnv('SAMPLE_SMS_TO', ''));
const ONLY_ALLOW_TO = normalizeDigitsToAscii(getEnv('SAMPLE_SMS_ONLY_ALLOW', '09120315101'));

function assertCanSendTo(toNumber) {
  if (!toNumber) throw new Error('Missing target. Provide --to=0912... or set SAMPLE_SMS_TO.');
  if (normalizeDigitsToAscii(toNumber) !== ONLY_ALLOW_TO) {
    throw new Error(`Refusing to send: only allowed target is ${ONLY_ALLOW_TO}.`);
  }
}

function canSendLiveNow() {
  if (args.dryRun) return false;
  if (SMS_MODE !== 'live') return false;
  if (!SMS_ALLOW_LIVE) return false;
  if (!SAMPLES_CAN_SEND) return false;
  if (!isProductionEnv()) return false;
  return true;
}

function userName(user) {
  const firstName = String(user?.firstName || '').trim();
  return firstName || 'کاربر';
}

function formatJalaliDateTimeParts(value) {
  if (!value) return { date: '', time: '' };

  if (!jalaliMoment) {
    // Fallback (should not happen in production; install jalali-moment)
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

function buildUserSms(kind, doc, user) {
  const name = userName(user);
  const greeting = name === 'کاربر' ? 'کاربر عزیز' : `${name} عزیز`;

  if (kind === 'userRegistration') {
    return [
      greeting,
      'پیش ثبت نام شما با موفقیت انجام شد.',
      'جهت تکمیل ثبت نام مراحل احراز هویت را کامل نمایید.',
      'پشتیبانی:07644421176',
    ].join('\n');
  }

  if (kind === 'kycApproved') {
    return [
      greeting,
      'احراز هویت شما در مهرسان گلد با موفقیت تأیید شد.',
      'اکنون میتوانید از تمام خدمات سامانه استفاده کنید.',
    ].join('\n');
  }

  if (kind === 'kycRejected') {
    const rejectReason = (doc && (doc.verifyDescription || doc.confirmDescription)) || 'نامشخص';
    return [
      greeting,
      'احراز هویت شما در مهرسان گلد تأیید نشد.',
      `دلیل: ${rejectReason}`,
      'لطفاً اطلاعات خود را اصلاح و مجدداً ارسال کنید.',
    ].join('\n');
  }

  if (kind === 'passwordChanged') {
    return [greeting, 'رمز عبور حساب شما در مهرسان گلد با موفقیت تغییر کرد.'].join('\n');
  }

  if (kind === 'depositRequest') {
    const amount = formatThousands(doc?.amount ?? doc?.total ?? doc?.value);
    const id = doc?._id || 'نامشخص';
    return [
      'درخواست واریز شما در مهرسان گلد ثبت شد.',
      `مبلغ: ${amount} تومان`,
      `شماره پیگیری: ${id}`,
      'پس از بررسی اطلاعرسانی خواهد شد.',
    ].join('\n');
  }

  if (kind === 'depositApproved') {
    const amount = formatThousands(doc?.amount ?? doc?.total ?? doc?.value);
    const walletBalance = user?.tomanBalance !== undefined && user?.tomanBalance !== null
      ? formatThousands(user.tomanBalance)
      : 'نامشخص';
    const when = doc?.updatedAt || doc?.createdAt;
    const { date, time } = formatJalaliDateTimeParts(when);

    return [
      'مهرسان گلد',
      'واریز شما در مهرسان گلد با موفقیت تأیید شد.',
      `مبلغ: ${amount} تومان`,
      `موجودی کیف پول: ${walletBalance} تومان`,
      `تاریخ: ${date}`,
      `ساعت: ${time}`,
    ].join('\n');
  }

  if (kind === 'depositRejected') {
    const amount = formatThousands(doc?.amount ?? doc?.total ?? doc?.value);
    const rejectReason = doc?.confirmDescription || doc?.verifyDescription || 'نامشخص';
    return [
      'درخواست واریز شما در مهرسان گلد تأیید نشد.',
      `مبلغ: ${amount} تومان`,
      `دلیل: ${rejectReason}`,
    ].join('\n');
  }

  if (kind === 'withdrawRequest') {
    const amount = formatThousands(doc?.amount ?? doc?.total ?? doc?.value);
    const id = doc?._id || 'نامشخص';
    return [
      'درخواست برداشت شما در مهرسان گلد ثبت شد.',
      `مبلغ: ${amount} تومان`,
      `شماره پیگیری: ${id}`,
      'در حال بررسی میباشد.',
    ].join('\n');
  }

  if (kind === 'withdrawApproved') {
    const amount = formatThousands(doc?.amount ?? doc?.total ?? doc?.value);
    const trackingCode = doc?.trackingCode || doc?._id || 'نامشخص';
    return [
      'برداشت شما از مهرسان گلد با موفقیت انجام شد.',
      `مبلغ: ${amount} تومان`,
      `شماره پیگیری: ${trackingCode}`,
    ].join('\n');
  }

  if (kind === 'buyTransaction' || kind === 'sellTransaction') {
    const tradeableLabel = mapTradeableLabel(doc?.tradeableName ?? doc?.tradeable ?? '-');
    const unit = mapTradeableUnit(tradeableLabel);
    const amount = formatThousands(doc?.amount ?? doc?.tradeableAmount ?? doc?.quantity);
    const total = formatThousands(doc?.total ?? doc?.price ?? doc?.value);

    const goldBalance = user?.goldBalance !== undefined && user?.goldBalance !== null ? formatThousands(user.goldBalance) : '0';
    const silverBalance = user?.silverBalance !== undefined && user?.silverBalance !== null ? formatThousands(user.silverBalance) : '0';
    const tomanBalance = user?.tomanBalance !== undefined && user?.tomanBalance !== null ? formatThousands(user.tomanBalance) : '0';

    const verb = kind === 'buyTransaction'
      ? 'خرید'
      : 'فروش';

    return [
      'مهرسان گلد',
      '',
      `${verb} ${amount} ${unit} ${tradeableLabel} به مبلغ ${total} با موفقیت انجام شد.`,
      `مانده موجودی طلا: ${goldBalance}`,
      `مانده موجودی نقره: ${silverBalance}`,
      `مانده موجودی تومان: ${tomanBalance}`,
    ].join('\n');
  }

  return null;
}

async function sampleOne(collection, match) {
  const docs = await collection.aggregate([
    { $match: match },
    { $sample: { size: 1 } },
  ]).toArray();
  return docs[0] || null;
}

async function resolveUser(db, userRef) {
  if (!userRef) return null;
  try {
    const id = typeof userRef === 'string' ? (ObjectId.isValid(userRef) ? new ObjectId(userRef) : userRef) : userRef;
    return await db.collection('users').findOne({ _id: id });
  } catch {
    return null;
  }
}

async function sendViaKavenegar(toNumber, message) {
  if (!KAVENEGAR_API_KEY) throw new Error('Missing KAVENEGAR_API_KEY');

  const api = Kavenegar.KavenegarApi({ apikey: KAVENEGAR_API_KEY.trim() });
  await new Promise((resolve, reject) => {
    api.Send(
      {
        message,
        sender: String(KAVENEGAR_SENDER).trim(),
        receptor: toNumber,
      },
      (response, status) => {
        if (status && Number(status) >= 200 && Number(status) < 300) return resolve(response);
        return reject(new Error(`Kavenegar status: ${status}`));
      }
    );
  });
}

async function main() {
  assertCanSendTo(TO_NUMBER);

  if (!MONGODB_URI || !MONGODB_DB) {
    throw new Error('Missing Mongo envs. Set MONGODB_URI (or MONGO_URI/DATABASE_URI) and MONGODB_DB.');
  }

  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(MONGODB_DB);

  const users = db.collection('users');
  const balanceTx = db.collection('balancetransactions');
  const transactions = db.collection('transactions');
  const tradeables = db.collection('tradeables');

  const randomUser = await sampleOne(users, { mobileNumber: { $exists: true, $ne: '' } });

  const requiredKinds = [
    'userRegistration',
    'kycApproved',
    'kycRejected',
    'passwordChanged',
    'depositRequest',
    'depositApproved',
    'depositRejected',
    'withdrawRequest',
    'withdrawApproved',
    'buyTransaction',
    'sellTransaction',
  ];

  const samples = [];

  // User-based events (use random user doc as both doc+user)
  samples.push({ kind: 'userRegistration', doc: randomUser, user: randomUser });
  samples.push({ kind: 'kycApproved', doc: { ...randomUser, verificationStatus: 'FirstLevelVerified' }, user: randomUser });
  samples.push({ kind: 'kycRejected', doc: { ...randomUser, verificationStatus: 'FirstLevelRejected', verifyDescription: randomUser?.verifyDescription || 'نامشخص' }, user: randomUser });
  samples.push({ kind: 'passwordChanged', doc: randomUser, user: randomUser });

  // Balance tx samples
  const depReq = await sampleOne(balanceTx, { type: { $regex: /(deposit|واریز)/i } });
  if (depReq) {
    const u = await resolveUser(db, depReq.user);
    samples.push({ kind: 'depositRequest', doc: depReq, user: u || randomUser });
  }

  const depAcc = await sampleOne(balanceTx, { type: { $regex: /(deposit|واریز)/i }, status: { $regex: /^(accepted|approved|confirmed)$/i } });
  if (depAcc) {
    const u = await resolveUser(db, depAcc.user);
    samples.push({ kind: 'depositApproved', doc: depAcc, user: u || randomUser });
  }

  const depRej = await sampleOne(balanceTx, { type: { $regex: /(deposit|واریز)/i }, status: { $regex: /^(rejected|declined)$/i } });
  if (depRej) {
    const u = await resolveUser(db, depRej.user);
    samples.push({ kind: 'depositRejected', doc: depRej, user: u || randomUser });
  }

  const wReq = await sampleOne(balanceTx, { type: { $regex: /(withdraw|برداشت)/i } });
  if (wReq) {
    const u = await resolveUser(db, wReq.user);
    samples.push({ kind: 'withdrawRequest', doc: wReq, user: u || randomUser });
  }

  const wAcc = await sampleOne(balanceTx, { type: { $regex: /(withdraw|برداشت)/i }, status: { $regex: /^(accepted|approved|confirmed)$/i } });
  if (wAcc) {
    const u = await resolveUser(db, wAcc.user);
    samples.push({ kind: 'withdrawApproved', doc: wAcc, user: u || randomUser });
  }

  // Transaction samples (buy/sell accepted)
  async function enrichTradeableName(doc) {
    if (!doc) return doc;
    if (doc.tradeableName) return doc;
    if (!doc.tradeable) return doc;
    try {
      const tradeableId = typeof doc.tradeable === 'string' && ObjectId.isValid(doc.tradeable) ? new ObjectId(doc.tradeable) : doc.tradeable;
      const t = await tradeables.findOne({ _id: tradeableId });
      const name = t ? (t.name || t.symbol || t.title || 'Unknown') : 'Unknown';
      return { ...doc, tradeableName: name };
    } catch {
      return doc;
    }
  }

  const buy = await sampleOne(transactions, { type: { $in: ['buy', 'purchase'] }, status: { $regex: /^(accepted|approved|confirmed|successful)$/i } });
  if (buy) {
    const u = await resolveUser(db, buy.user);
    samples.push({ kind: 'buyTransaction', doc: await enrichTradeableName(buy), user: u || randomUser });
  }

  const sell = await sampleOne(transactions, { type: 'sell', status: { $regex: /^(accepted|approved|confirmed|successful)$/i } });
  if (sell) {
    const u = await resolveUser(db, sell.user);
    samples.push({ kind: 'sellTransaction', doc: await enrichTradeableName(sell), user: u || randomUser });
  }

  // Limit how many messages we attempt.
  const finalSamples = samples.filter((s) => s && s.kind).slice(0, args.limit);

  const presentKinds = new Set(finalSamples.map((s) => s.kind));
  const missingKinds = requiredKinds.filter((k) => !presentKinds.has(k));

  console.log(`Target: ${TO_NUMBER}`);
  console.log(`Mode: ${canSendLiveNow() ? 'LIVE SEND' : 'DRY-RUN'}`);
  console.log(`Samples prepared: ${finalSamples.length}`);
  if (missingKinds.length) {
    console.log(`Missing (not found in DB): ${missingKinds.join(', ')}`);
  }

  for (const s of finalSamples) {
    const message = buildUserSms(s.kind, s.doc, s.user);
    if (!message) {
      console.warn('Skip: no template for', s.kind);
      continue;
    }

    console.log('\n' + '-'.repeat(60));
    console.log(`Kind: ${s.kind}`);
    console.log(message);

    if (canSendLiveNow()) {
      await sendViaKavenegar(TO_NUMBER, message);
      console.log('SENT');
    }
  }

  if (!canSendLiveNow()) {
    console.log('\nNOTE: Nothing was sent. To actually send, run with:');
    console.log('  NODE_ENV=production SMS_MODE=live SMS_ALLOW_LIVE=true SAMPLES_CAN_SEND=true node send-sample-user-sms.js --send --to=09120315101');
  }

  await client.close();
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
