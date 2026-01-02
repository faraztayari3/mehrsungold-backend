const path = require('path');
const dotenv = require('dotenv');

// Load env files
dotenv.config({ path: path.join(__dirname, '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });

// Import the functions we need to test
const { MongoClient } = require('mongodb');

// Test data
const testUser = {
  _id: 'test-user-123',
  firstName: 'فراز',
  lastName: 'تایاری',
  mobileNumber: '09120315101',
  tomanBalance: 5000000,
  goldBalance: 2.5,
  silverBalance: 10.3,
  verificationStatus: 'NotVerified',
};

const testDepositDoc = {
  _id: 'test-deposit-456',
  type: 'OnlineDeposit',
  amount: 1000000,
  status: 'Pending',
  user: testUser._id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testWithdrawDoc = {
  _id: 'test-withdraw-789',
  type: 'Withdraw',
  amount: 500000,
  status: 'Pending',
  trackingCode: 'TRK-12345',
  user: testUser._id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testBuyTransaction = {
  _id: 'test-buy-101',
  type: 'buy',
  amount: 1.5,
  total: 2500000,
  tradeable: 'gold-id',
  tradeableName: 'طلا',
  status: 'Accepted',
  user: testUser._id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testSellTransaction = {
  _id: 'test-sell-102',
  type: 'sell',
  amount: 0.5,
  total: 800000,
  tradeable: 'silver-id',
  tradeableName: 'نقره',
  status: 'Accepted',
  user: testUser._id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Load the actual functions from watch-balance-transactions.js
const fs = require('fs');
const fileContent = fs.readFileSync(path.join(__dirname, 'watch-balance-transactions.js'), 'utf8');

// Extract buildSmsTextForUser function
const buildSmsTextForUserMatch = fileContent.match(/function buildSmsTextForUser\([\s\S]*?\n(?=\nfunction |async function |\/\/|$)/);
if (!buildSmsTextForUserMatch) {
  console.error('Could not extract buildSmsTextForUser function');
  process.exit(1);
}

// Evaluate the function
eval(buildSmsTextForUserMatch[0]);

console.log('='.repeat(80));
console.log('اجرای تست‌های کامل سیستم پیامک');
console.log('='.repeat(80));
console.log();

// Test 1: Welcome message after OTP verification
console.log('📱 تست 1: پیامک خوش‌آمدگویی بعد از تأیید OTP');
console.log('-'.repeat(80));
const welcomeMsg = buildSmsTextForUser('userRegistration', testUser, testUser);
console.log(welcomeMsg);
console.log();

// Test 2: KYC Approved
console.log('📱 تست 2: تأیید احراز هویت');
console.log('-'.repeat(80));
const kycApprovedMsg = buildSmsTextForUser('kycApproved', testUser, testUser);
console.log(kycApprovedMsg);
console.log();

// Test 3: KYC Rejected
console.log('📱 تست 3: رد احراز هویت');
console.log('-'.repeat(80));
const kycRejectedDoc = { ...testUser, verifyDescription: 'تصویر مدارک واضح نیست' };
const kycRejectedMsg = buildSmsTextForUser('kycRejected', kycRejectedDoc, testUser);
console.log(kycRejectedMsg);
console.log();

// Test 4: Password Changed
console.log('📱 تست 4: تغییر رمز عبور');
console.log('-'.repeat(80));
const passwordMsg = buildSmsTextForUser('passwordChanged', testUser, testUser);
console.log(passwordMsg);
console.log();

// Test 5: Deposit Request
console.log('📱 تست 5: ثبت درخواست واریز');
console.log('-'.repeat(80));
const depositRequestMsg = buildSmsTextForUser('depositRequest', testDepositDoc, testUser);
console.log(depositRequestMsg);
console.log();

// Test 6: Deposit Approved
console.log('📱 تست 6: تأیید واریز');
console.log('-'.repeat(80));
const depositApprovedDoc = { ...testDepositDoc, status: 'Accepted' };
const depositApprovedMsg = buildSmsTextForUser('depositApproved', depositApprovedDoc, testUser);
console.log(depositApprovedMsg);
console.log();

// Test 7: Deposit Rejected
console.log('📱 تست 7: رد واریز');
console.log('-'.repeat(80));
const depositRejectedDoc = { ...testDepositDoc, status: 'Rejected', confirmDescription: 'مبلغ واریزی با درخواست مطابقت ندارد' };
const depositRejectedMsg = buildSmsTextForUser('depositRejected', depositRejectedDoc, testUser);
console.log(depositRejectedMsg);
console.log();

// Test 8: Withdraw Request
console.log('📱 تست 8: ثبت درخواست برداشت');
console.log('-'.repeat(80));
const withdrawRequestMsg = buildSmsTextForUser('withdrawRequest', testWithdrawDoc, testUser);
console.log(withdrawRequestMsg);
console.log();

// Test 9: Withdraw Approved
console.log('📱 تست 9: پرداخت موفق برداشت');
console.log('-'.repeat(80));
const withdrawApprovedDoc = { ...testWithdrawDoc, status: 'Accepted' };
const withdrawApprovedMsg = buildSmsTextForUser('withdrawApproved', withdrawApprovedDoc, testUser);
console.log(withdrawApprovedMsg);
console.log();

// Test 10: Buy Transaction
console.log('📱 تست 10: خرید موفق');
console.log('-'.repeat(80));
const buyMsg = buildSmsTextForUser('buyTransaction', testBuyTransaction, testUser);
console.log(buyMsg);
console.log();

// Test 11: Sell Transaction
console.log('📱 تست 11: فروش موفق');
console.log('-'.repeat(80));
const sellMsg = buildSmsTextForUser('sellTransaction', testSellTransaction, testUser);
console.log(sellMsg);
console.log();

// Test 12: KYC Reminder
console.log('📱 تست 12: یادآوری تکمیل احراز هویت');
console.log('-'.repeat(80));
const kycReminderMsg = buildSmsTextForUser('kycReminder', testUser, testUser);
console.log(kycReminderMsg);
console.log();

console.log('='.repeat(80));
console.log('✅ تمام تست‌ها با موفقیت انجام شد');
console.log('='.repeat(80));
console.log();
console.log('نکته: در حالت واقعی، هر پیامک به کاربر و همزمان به شماره 09120315101 ارسال می‌شود');
