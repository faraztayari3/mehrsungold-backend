# نصب ماژول SMS در پروژه

## مراحل نصب:

### 1. نصب کتابخانه Kavenegar
```bash
cd /Users/faraz/Desktop/Repo/Back/mehrsungold-backend
npm install kavenegar --save
```

### 2. اضافه کردن ماژول به app.module.js

فایل `app.module.js` رو باز کنید و در قسمت imports، خط زیر رو اضافه کنید:

```javascript
const { SmsModule } = require('./sms/sms.module');
```

سپس `SmsModule` رو به آرایه imports در دکوراتور Module اضافه کنید.

**نکته**: چون فایل obfuscate شده، باید به صورت دستی این کار رو انجام بدین یا فایل اصلی رو ویرایش کنین.

### 3. ری‌استارت سرور

```bash
# اگر از nodemon استفاده می‌کنید، خودکار ری‌استارت میشه
# در غیر این صورت:
npm run start
```

## استفاده در کد

### مثال 1: ارسال پیامک ثبت نام

در فایل `auth/auth.service.js` یا `user/user.service.js`:

```javascript
const { SmsService } = require('../sms/sms.service');

// در constructor
constructor(smsService) {
    this.smsService = smsService;
}

// بعد از ثبت نام کاربر
async register(userData) {
    const user = await this.userModel.create(userData);
    
    // ارسال پیامک خوش آمدگویی
    try {
        await this.smsService.sendRegistrationSMS(user);
    } catch (error) {
        // خطا لاگ میشه ولی کار ادامه پیدا میکنه
    }
    
    return user;
}
```

### مثال 2: ارسال پیامک واریز

در فایل `balance-transaction/balance-transaction.service.js`:

```javascript
const { SmsService } = require('../sms/sms.service');

// در constructor
constructor(smsService, userModel) {
    this.smsService = smsService;
    this.userModel = userModel;
}

// بعد از تایید واریز
async approveDeposit(transactionId) {
    const transaction = await this.findById(transactionId);
    const user = await this.userModel.findById(transaction.user);
    
    // بروزرسانی موجودی
    user.tomanBalance += transaction.amount;
    await user.save();
    
    // ارسال پیامک
    try {
        await this.smsService.sendDepositSMS(user, transaction);
    } catch (error) {
        // خطا لاگ میشه
    }
    
    return transaction;
}
```

### مثال 3: ارسال پیامک برداشت

```javascript
async approveWithdrawal(transactionId) {
    const transaction = await this.findById(transactionId);
    const user = await this.userModel.findById(transaction.user);
    
    // بروزرسانی موجودی
    user.tomanBalance -= transaction.amount;
    await user.save();
    
    // ارسال پیامک
    try {
        await this.smsService.sendWithdrawalSMS(user, transaction);
    } catch (error) {
        // خطا لاگ میشه
    }
    
    return transaction;
}
```

## API Endpoints

بعد از نصب، این endpoint ها در دسترس هستند:

```
GET  /settings/sms          - دریافت تنظیمات (نیاز به احراز هویت)
PUT  /settings/sms          - بروزرسانی تنظیمات (نیاز به احراز هویت)
```

## تست

### 1. لاگین کنید و توکن بگیرید
```bash
curl -X POST http://localhost:3003/auth/admin/login/password \
  -H "Content-Type: application/json" \
  -d '{"mobileNumber":"09122192356","password":"Livnhn4425"}'
```

### 2. تنظیمات رو دریافت کنید
```bash
curl -X GET http://localhost:3003/settings/sms \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. تنظیمات رو فعال کنید
```bash
curl -X PUT http://localhost:3003/settings/sms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "registration": {
        "enabled": true,
        "template": "سلام [نام کاربر] عزیز، به مهرسان گلد خوش آمدید!"
    },
    "deposit": {
        "enabled": true,
        "template": "مبلغ [مبلغ تراکنش] تومان به حساب شما واریز شد."
    },
    "withdrawal": {
        "enabled": true,
        "template": "مبلغ [مبلغ تراکنش] تومان از حساب شما برداشت شد."
    },
    "verifiedUsers": {
        "enabled": false,
        "template": "پیام به کاربران احراز شده"
    },
    "unverifiedUsers": {
        "enabled": false,
        "template": "لطفا احراز هویت خود را تکمیل کنید."
    }
}'
```

## تنظیمات Kavenegar

اطلاعات Kavenegar در فایل `sms/sms.service.js` خط 25-28 قرار داره:

```javascript
this.api = Kavenegar.KavenegarApi({
    apikey: '4B37447A59365645492B5A52646F674E785474384F6D75373872396C6E5A334C5A31367650576A306E73673D'
});
this.sender = '2000660110';
```

## نکات مهم

1. ✅ تمام فایل‌های SMS Module آماده و در فولدر `sms/` قرار دارند
2. ✅ کتابخانه kavenegar نصب شده (`npm install kavenegar`)
3. ⚠️  فقط باید `SmsModule` رو به `app.module.js` اضافه کنید
4. ✅ هیچ migration یا تغییر دیتابیسی لازم نیست (خودکار ایجاد میشه)
5. ✅ تمام خطاها handle شدن و برنامه رو متوقف نمی‌کنن

## فایل های ایجاد شده:

```
sms/
├── index.js                           # Export اصلی
├── sms.module.js                      # ماژول اصلی
├── sms.controller.js                  # Controller
├── sms.service.js                     # Service و لاجیک اصلی
├── README.md                          # مستندات کامل
├── dto/
│   └── sms-settings.dto.js           # DTO برای validation
└── schema/
    └── sms-settings.schema.js        # Schema مونگو
```

## پشتیبانی

اگر مشکلی پیش اومد:

1. لاگ های سرور رو چک کنید
2. مطمئن بشید kavenegar نصب شده
3. مطمئن بشید SmsModule به app.module اضافه شده
4. API Key و Sender Number کاوه نگار رو چک کنید
