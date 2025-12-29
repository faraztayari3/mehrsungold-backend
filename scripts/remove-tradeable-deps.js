#!/usr/bin/env node

/*
  Removes documents that reference a given Tradeable so it can be deleted.

  Default mode is DRY-RUN (no deletes).

  Examples:
    node scripts/remove-tradeable-deps.js --symbol USDT
    node scripts/remove-tradeable-deps.js --symbol USDT --apply
    node scripts/remove-tradeable-deps.js --tradeableId 65ed7135b8e0f6f4f3c5baf2 --apply

  Env:
    DATABASE_URI must be set (same as backend .env)
*/

require('dotenv').config();

const mongoose = require('mongoose');

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

async function listCollections(db) {
  return db.listCollections({}, { nameOnly: true }).toArray();
}

function pickCollectionName(collections, preferredNames, regexFallback) {
  const names = new Set(collections.map((c) => c.name));
  for (const preferred of preferredNames) {
    if (names.has(preferred)) return preferred;
  }
  const fallback = collections.find((c) => regexFallback.test(c.name));
  return fallback ? fallback.name : null;
}

function toObjectIdOrThrow(id) {
  if (!id || typeof id !== 'string') throw new Error('Invalid id');
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error(`Invalid ObjectId: ${id}`);
  return new mongoose.Types.ObjectId(id);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const symbol = (args.symbol || 'USDT').toString().trim();
  const nameFa = args.nameFa ? args.nameFa.toString().trim() : null;
  const tradeableIdArg = args.tradeableId ? args.tradeableId.toString().trim() : null;
  const apply = Boolean(args.apply);
  const deleteTradeable = Boolean(args.deleteTradeable);
  const scanAll = Boolean(args.scanAll);

  const DATABASE_URI = process.env.DATABASE_URI;
  if (!DATABASE_URI) {
    console.error('Missing DATABASE_URI. Set it in backend .env (see .env.example).');
    process.exit(1);
  }

  console.log(`Mode: ${apply ? 'APPLY (will delete)' : 'DRY-RUN (no deletes)'}`);
  console.log(`Target: ${tradeableIdArg ? `tradeableId=${tradeableIdArg}` : nameFa ? `nameFa=${nameFa}` : `symbol=${symbol}`}`);

  await mongoose.connect(DATABASE_URI, {
    serverSelectionTimeoutMS: 15000,
  });

  try {
    const db = mongoose.connection.db;
    const collections = await listCollections(db);

    const tradeablesCollName = pickCollectionName(collections, ['tradeables'], /tradeables?/i);
    if (!tradeablesCollName) {
      throw new Error('Could not find tradeables collection (expected "tradeables").');
    }

    const tradeables = db.collection(tradeablesCollName);

    let tradeableDoc = null;
    if (tradeableIdArg) {
      tradeableDoc = await tradeables.findOne({ _id: toObjectIdOrThrow(tradeableIdArg) });
    } else if (nameFa) {
      tradeableDoc = await tradeables.findOne({ nameFa });
    } else {
      tradeableDoc = await tradeables.findOne({ symbol: symbol.toUpperCase() });
    }

    if (!tradeableDoc) {
      console.error('Tradeable not found by the provided selector.');

      const searchTerms = new Set();
      if (tradeableIdArg) searchTerms.add(tradeableIdArg);
      if (nameFa) searchTerms.add(nameFa);
      if (symbol) searchTerms.add(symbol);
      if (symbol.toUpperCase() === 'USDT') {
        searchTerms.add('تتر');
        searchTerms.add('tether');
      }

      const or = Array.from(searchTerms)
        .filter(Boolean)
        .flatMap((term) => {
          const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const rx = new RegExp(safe, 'i');
          return [{ symbol: rx }, { name: rx }, { nameFa: rx }];
        });

      const suggestions = or.length
        ? await tradeables
            .find({ $or: or })
            .project({ _id: 1, symbol: 1, name: 1, nameFa: 1 })
            .limit(10)
            .toArray()
        : [];

      if (suggestions.length) {
        console.error('Closest matches (copy _id and rerun with --tradeableId):');
        for (const s of suggestions) {
          console.error({ _id: String(s._id), symbol: s.symbol, name: s.name, nameFa: s.nameFa });
        }
      } else {
        console.error('No similar tradeables found. Try --nameFa "تتر" or locate the _id from the admin list.');
      }

      process.exitCode = 2;
      return;
    }

    const tradeableId = tradeableDoc._id;
    const tradeableIdString = String(tradeableId);

    console.log('Resolved tradeable:');
    console.log({
      _id: tradeableIdString,
      symbol: tradeableDoc.symbol,
      name: tradeableDoc.name,
      nameFa: tradeableDoc.nameFa,
    });

    const idFilter = { $in: [tradeableId, tradeableIdString] };

    const knownCollections = [
      { label: 'transactions', preferred: ['transactions'], pattern: /transactions?/i, filter: { tradeable: idFilter } },
      { label: 'products', preferred: ['products'], pattern: /products?/i, filter: { tradeable: idFilter } },
      { label: 'userinventories', preferred: ['userinventories'], pattern: /user\W*inventor/i, filter: { tradeable: idFilter } },
      { label: 'userfees', preferred: ['userfees'], pattern: /user\W*fees?/i, filter: { tradeable: idFilter } },
      { label: 'tradelimits', preferred: ['tradelimits', 'tradeLimits'], pattern: /trade\W*limits?/i, filter: { tradeable: idFilter } },
    ];

    const resolved = [];
    for (const def of knownCollections) {
      const collName = pickCollectionName(collections, def.preferred, def.pattern);
      resolved.push({ ...def, collName });
    }

    // Report + optionally delete
    const report = [];

    for (const item of resolved) {
      if (!item.collName) {
        report.push({ collection: item.label, found: false, count: null });
        continue;
      }
      const coll = db.collection(item.collName);
      const count = await coll.countDocuments(item.filter);
      report.push({ collection: item.collName, logical: item.label, found: true, count });

      if (apply && count > 0) {
        const res = await coll.deleteMany(item.filter);
        console.log(`Deleted from ${item.collName}: ${res.deletedCount}`);
      }
    }

    console.log('Dependency report:');
    for (const row of report) {
      if (!row.found) {
        console.log(`- ${row.collection}: (collection not found)`);
      } else {
        console.log(`- ${row.collection}: ${row.count}`);
      }
    }

    if (scanAll) {
      console.log('scanAll enabled: counting {tradeable: <id>} across all collections...');
      for (const c of collections) {
        // Skip already checked collections
        if (report.some((r) => r.found && r.collection === c.name)) continue;
        try {
          const coll = db.collection(c.name);
          const count = await coll.countDocuments({ tradeable: idFilter });
          if (count > 0) {
            console.log(`- ${c.name}: ${count}`);
            if (apply) {
              const res = await coll.deleteMany({ tradeable: idFilter });
              console.log(`  Deleted from ${c.name}: ${res.deletedCount}`);
            }
          }
        } catch {
          // ignore collections that don't support countDocuments well (views/etc)
        }
      }
    }

    if (apply && deleteTradeable) {
      const res = await tradeables.deleteOne({ _id: tradeableId });
      console.log(`Deleted tradeable from ${tradeablesCollName}: ${res.deletedCount}`);
    } else {
      console.log('Next step: now delete the tradeable from Admin UI (or rerun with --deleteTradeable).');
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
