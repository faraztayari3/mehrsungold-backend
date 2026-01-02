/*
  Resets priceAdjustmentPercent to 0 for gold/silver tradeables.

  Why:
  - Live prices should reflect raw API values (no percent manipulation).
  - This script is safe to run multiple times.

  Usage:
    DATABASE_URI='mongodb://...' node scripts/reset-gold-silver-price-adjustments.js

  Optional filters:
    --dry-run   (default)
    --apply     (actually writes)
*/

'use strict';

const mongoose = require('mongoose');

const args = new Set(process.argv.slice(2));
const isApply = args.has('--apply');
const isDryRun = !isApply;

const DATABASE_URI = process.env.DATABASE_URI;
if (!DATABASE_URI) {
  console.error('[ERROR] DATABASE_URI env var is required');
  process.exit(1);
}

function isGoldOrSilver(doc) {
  const name = String(doc?.name || '').toLowerCase();
  const nameFa = String(doc?.nameFa || '').trim();

  if (nameFa.includes('طلا') || nameFa.includes('نقره')) return true;

  // Common tickers / English names
  if (name.includes('gold') || name.includes('silver')) return true;
  if (name.includes('xau') || name.includes('xag')) return true;

  return false;
}

async function main() {
  await mongoose.connect(DATABASE_URI, { serverSelectionTimeoutMS: 15000 });

  const tradeableSchema = new mongoose.Schema(
    {
      name: String,
      nameFa: String,
      priceAdjustmentPercent: mongoose.Schema.Types.Mixed,
      onlinePriceUpdate: Boolean
    },
    { strict: false, collection: 'tradeables' }
  );

  const Tradeable = mongoose.model('Tradeable', tradeableSchema);

  const all = await Tradeable.find({}, { name: 1, nameFa: 1, priceAdjustmentPercent: 1, onlinePriceUpdate: 1 }).lean();
  const targets = all.filter(isGoldOrSilver);

  console.log(`[INFO] Found ${targets.length} gold/silver tradeables`);

  const toFix = targets.filter((t) => {
    const v = t.priceAdjustmentPercent;
    // treat undefined/null/0 as ok
    if (v === undefined || v === null) return false;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n !== 0;
  });

  if (!toFix.length) {
    console.log('[OK] No non-zero priceAdjustmentPercent found for gold/silver');
    return;
  }

  console.log(`[INFO] Will reset ${toFix.length} tradeables to 0`);
  for (const t of toFix) {
    console.log(`- ${t.nameFa || t.name} (id=${t._id}) current=${t.priceAdjustmentPercent}`);
  }

  if (isDryRun) {
    console.log('[DRY-RUN] No changes applied. Re-run with --apply to write.');
    return;
  }

  const ids = toFix.map((t) => t._id);
  const res = await Tradeable.updateMany({ _id: { $in: ids } }, { $set: { priceAdjustmentPercent: 0 } });

  console.log(`[OK] Updated: matched=${res.matchedCount ?? res.n ?? 0} modified=${res.modifiedCount ?? res.nModified ?? 0}`);
}

main()
  .catch((err) => {
    console.error('[ERROR]', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
