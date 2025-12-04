require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const {
  MONGODB_URI, MONGODB_DB, MONGODB_COLLECTION,
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, ALERT_TO
} = process.env;

if (!MONGODB_URI || !MONGODB_DB || !MONGODB_COLLECTION) {
  console.error('Missing Mongo envs. Set MONGODB_URI, MONGODB_DB, MONGODB_COLLECTION.');
  process.exit(1);
}
if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !ALERT_TO) {
  console.error('Missing SMTP envs. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_TO.');
  process.exit(1);
}

// ---------- email ----------
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// Function to send the email with both transaction and user details
async function sendEmail(subject, doc, user) {
  const userDetails = user ? `User: ${user.firstName || '-'} ${user.lastName || '-'} (${user.mobileNumber || '-'})` : '';
  
  const body = [
    `Type: ${doc.type ?? '-'}`,
    `Amount: ${doc.amount ?? '-'}`,
    `Wage: ${doc.wage ?? '-'}`,
    `Total: ${doc.total ?? '-'}`,
    `TradeablePrice: ${doc.tradeablePrice ?? '-'}`,
    `Tradeable: ${doc.tradeableName ?? doc.tradeable ?? '-'}`,
    `Status: ${doc.status ?? '-'}`,
    `CreatedAt: ${doc.createdAt ?? '-'}`,
    `UpdatedAt: ${doc.updatedAt ?? '-'}`,
    `ConfirmDescription: ${doc.confirmDescription ?? '-'}`,
    `_id: ${doc._id}`,
    userDetails, // Add user details to the email
  ].join('\n');

  try {
    await transporter.sendMail({
      from: SMTP_FROM || '"Notifier" <no-reply@example.com>',
      to: ALERT_TO,
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
    const resume = loadToken('tx');
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
    const resume = loadToken('users');
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
    const resume = loadToken('transactions');
    const opts = { fullDocument: 'updateLookup', ...(resume ? { startAfter: resume } : {}) };
    transactionsStream = collTransactions.watch(pipelineTransactions, opts);

    transactionsStream.on('change', async (ev) => {
      const doc = ev.fullDocument || {};
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
  startTxStream();
  startUsersStream();
  startTransactionsStream();
}

main().catch((err) => {
  console.error('Fatal:', err?.message || err);
  process.exit(2);
});