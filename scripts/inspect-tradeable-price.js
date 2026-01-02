#!/usr/bin/env node

/*
  Inspect a tradeable's stored price vs the raw API price and the saved priceAdjustmentPercent.

  Usage:
    node scripts/inspect-tradeable-price.js --nameFa "نقره"
    node scripts/inspect-tradeable-price.js --name silver
    node scripts/inspect-tradeable-price.js --id <ObjectId>

  Env:
    DATABASE_URI must be set (same as backend .env)
*/

require('dotenv').config();

const mongoose = require('mongoose');
const { getPriceFromApi, toToman } = require('../common/utils');
const axios = require('axios');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const [rawKey, rawValue] = token.slice(2).split('=');
    const key = rawKey.trim();
    const value = rawValue !== undefined ? rawValue : argv[i + 1];

    if (rawValue === undefined && value && !value.startsWith('--')) {
      args[key] = value;
      i += 1;
    } else if (rawValue !== undefined) {
      args[key] = rawValue;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function applyPriceAdjustment(price, percent) {
  if (typeof price !== 'number' || !Number.isFinite(price)) return price;
  const p = typeof percent === 'number' && Number.isFinite(percent) ? percent : 0;
  return p ? price * (1 + p / 100) : price;
}

function formatNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
  return n.toLocaleString('en-US');
}

function headerKeys(headers) {
  if (!Array.isArray(headers)) return [];
  return headers
    .map((h) => (h && typeof h.key === 'string' ? h.key : null))
    .filter(Boolean);
}

function safePreview(value, depth = 2) {
  if (depth <= 0) return '[depth-limit]';
  if (value === null) return null;
  if (value === undefined) return undefined;
  const t = typeof value;
  if (t === 'string') return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  if (t === 'number' || t === 'boolean') return value;
  if (Array.isArray(value)) {
    return {
      __type: 'array',
      length: value.length,
      first: value.length ? safePreview(value[0], depth - 1) : undefined,
    };
  }
  if (t === 'object') {
    const keys = Object.keys(value);
    const out = { __type: 'object', keys: keys.slice(0, 30) };
    for (const k of keys.slice(0, 10)) {
      out[k] = safePreview(value[k], depth - 1);
    }
    return out;
  }
  return String(value);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const id = args.id ? String(args.id).trim() : null;
  const name = args.name ? String(args.name).trim() : null;
  const nameFa = args.nameFa ? String(args.nameFa).trim() : null;

  const DATABASE_URI = process.env.DATABASE_URI;
  if (!DATABASE_URI) {
    console.error('Missing DATABASE_URI. Set it in backend .env (see .env.example).');
    process.exit(1);
  }

  await mongoose.connect(DATABASE_URI, { serverSelectionTimeoutMS: 15000 });

  try {
    const db = mongoose.connection.db;
    const tradeables = db.collection('tradeables');

    let doc = null;
    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) throw new Error(`Invalid ObjectId: ${id}`);
      doc = await tradeables.findOne({ _id: new mongoose.Types.ObjectId(id) });
    } else if (nameFa) {
      doc = await tradeables.findOne({ nameFa });
    } else if (name) {
      doc = await tradeables.findOne({ name });
    } else {
      // Default: try to find silver
      doc = await tradeables.findOne({
        $or: [
          { name: /silver/i },
          { nameFa: /نقره/i },
        ],
      });
    }

    if (!doc) {
      console.error('Tradeable not found. Provide --id, --name, or --nameFa.');
      process.exit(2);
    }

    const storedPrice = typeof doc.price === 'number' ? doc.price : Number(doc.price);
    const percent = typeof doc.priceAdjustmentPercent === 'number' ? doc.priceAdjustmentPercent : Number(doc.priceAdjustmentPercent);

    console.log('--- Tradeable ---');
    console.log({
      _id: String(doc._id),
      name: doc.name,
      nameFa: doc.nameFa,
      isToman: doc.isToman,
      onlinePriceUpdate: doc.onlinePriceUpdate,
      enableZarbahaApi: doc.enableZarbahaApi,
      priceApi: doc.priceApi,
      pricePathInApi: doc.pricePathInApi,
      priceApiMethod: doc.priceApiMethod,
      priceApiHeaderKeys: headerKeys(doc.priceApiHeaders),
      priceAdjustmentPercent: doc.priceAdjustmentPercent,
      storedPrice: doc.price,
      updatedAt: doc.updatedAt,
    });

    let apiPriceRaw = null;
    let baseToman = null;

    if (doc.enableZarbahaApi) {
      console.log('NOTE: enableZarbahaApi=true; this script does not fetch Zarbaha price (needs SettingsService token).');
    } else if (doc.onlinePriceUpdate && doc.priceApi && doc.pricePathInApi) {
      try {
        apiPriceRaw = await getPriceFromApi(doc.priceApi, doc.pricePathInApi, doc.priceApiMethod, doc.priceApiHeaders || []);
        baseToman = doc.isToman ? apiPriceRaw : toToman(apiPriceRaw);
      } catch (err) {
        console.log('--- API fetch failed via getPriceFromApi ---');
        console.log(String(err?.message || err));

        // Try a raw request to show response structure (without leaking header values).
        try {
          const headersObj = {};
          for (const { key, value } of doc.priceApiHeaders || []) {
            if (typeof key === 'string') headersObj[key] = value;
          }

          const resp = await axios.request({
            url: doc.priceApi,
            method: doc.priceApiMethod || 'GET',
            headers: headersObj,
            timeout: 6000,
            validateStatus: () => true,
          });

          console.log('--- API response shape (sanitized) ---');
          console.log({
            status: resp.status,
            topLevel: safePreview(resp.data, 2),
          });
        } catch (err2) {
          console.log('--- API raw request also failed ---');
          console.log(String(err2?.message || err2));
        }

        // Fallback so we can still show deltas.
        baseToman = storedPrice;
      }
    } else {
      console.log('NOTE: onlinePriceUpdate=false or missing priceApi; using stored price as base.');
      baseToman = storedPrice;
    }

    const adjusted = applyPriceAdjustment(baseToman, Number.isFinite(percent) ? percent : 0);

    console.log('--- Prices (toman) ---');
    console.log({
      apiPriceRaw,
      baseToman,
      adjustedFromBase: adjusted,
      storedPrice,
    });

    if (typeof baseToman === 'number' && Number.isFinite(baseToman) && baseToman !== 0) {
      const impliedPercent = ((storedPrice - baseToman) / baseToman) * 100;
      console.log('--- Delta ---');
      console.log({
        storedMinusBase: storedPrice - baseToman,
        impliedPercentFromStored: impliedPercent,
      });

      console.log(
        `Summary: stored=${formatNumber(storedPrice)} base=${formatNumber(baseToman)} diff=${formatNumber(storedPrice - baseToman)} (~${impliedPercent.toFixed(6)}%) percentField=${doc.priceAdjustmentPercent}`
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Inspect failed:', err?.message || err);
  process.exit(1);
});
