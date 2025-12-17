#!/usr/bin/env node
/**
 * Migration script to fix report URLs in transactionreports collection
 * 
 * Problem: URLs are stored as /file/report/<token>.xlsx instead of /report/<token>.xlsx
 * This script updates all documents to use the correct path.
 * 
 * Usage: node fix-report-urls.js [--dry-run]
 */

require('dotenv').config();
const mongoose = require('mongoose');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.DATABASE_URI);
    console.log('✓ Connected\n');

    const db = mongoose.connection.db;
    const collection = db.collection('transactionreports');

    // Find all documents with /file/report/ in URL
    const query = { url: { $regex: '^/file/report/' } };
    const count = await collection.countDocuments(query);

    console.log(`Found ${count} documents with incorrect URL format`);

    if (count === 0) {
      console.log('✓ All URLs are already correct');
      process.exit(0);
    }

    if (dryRun) {
      console.log('\n--dry-run mode: Showing sample documents without making changes\n');
      const samples = await collection.find(query).limit(5).toArray();
      samples.forEach((doc, idx) => {
        const oldUrl = doc.url;
        const newUrl = oldUrl.replace('/file/report/', '/report/');
        console.log(`${idx + 1}. ${doc._id}`);
        console.log(`   OLD: ${oldUrl}`);
        console.log(`   NEW: ${newUrl}\n`);
      });
      console.log(`Use: node fix-report-urls.js (without --dry-run) to apply changes`);
    } else {
      console.log('\nUpdating URLs...');
      const result = await collection.updateMany(
        query,
        [
          {
            $set: {
              url: {
                $replaceOne: {
                  input: '$url',
                  find: '/file/report/',
                  replacement: '/report/',
                },
              },
            },
          },
        ]
      );

      console.log(`\n✓ Updated ${result.modifiedCount} documents`);
      console.log(`  Matched: ${result.matchedCount}`);

      // Verify by sampling
      const sample = await collection.findOne({ url: { $regex: '^/report/' } });
      if (sample) {
        console.log(`\n  Sample after fix: ${sample.url}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
