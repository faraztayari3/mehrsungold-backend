'use strict';

// Quick sanity check for DTO whitelist/forbidNonWhitelisted behavior.
// Usage: node scripts/check-tradeable-price-adjustment-dto.js

const { ValidationPipe } = require('@nestjs/common');
const { UpdateTradeableDto } = require('../tradeable/dto/update-tradeable.dto');

async function main() {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const sampleBody = {
    priceAdjustmentPercent: 0,
    name: 'sample',
  };

  try {
    const out = await pipe.transform(sampleBody, { type: 'body', metatype: UpdateTradeableDto });
    // If we got here, priceAdjustmentPercent is whitelisted and accepted.
    console.log('[OK] UpdateTradeableDto accepts priceAdjustmentPercent');
    console.log(out);
    process.exit(0);
  } catch (err) {
    console.error('[FAIL] UpdateTradeableDto rejected priceAdjustmentPercent');
    console.error(err?.message);
    console.error(err?.response || err);
    process.exit(1);
  }
}

main();
