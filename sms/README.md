# SMS Module - راهنمای نصب و استفاده

## نصب

### 1. نصب کتابخانه Kavenegar
```bash
npm install kavenegar --save
```

### 2. اضافه کردن ماژول به app.module.js

در فایل `app.module.js`، ماژول SMS را import و به لیست imports اضافه کنید:

```javascript
const { SmsModule } = require('./sms/sms.module');

// در قسمت imports آرایه Module
imports: [
    // ... سایر imports
    SmsModule  // اضافه کنید
]
```

## API Endpoints

### 1. دریافت تنظیمات پیامک
```
GET /settings/sms
Authorization: Bearer {token}
Roles: SuperAdmin, Admin
```

**Response:**
```json
{
    "registration": {
        "enabled": false,
        "template": "سلام [نام کاربر] [نام خانوادگی] عزیز، به مهرسان گلد خوش آمدید."
    },
    "deposit": {
        "enabled": false,
        "template": "سلام [نام کاربر]، مبلغ [مبلغ تراکنش] تومان به حساب شما واریز شد."
    },
    "withdrawal": {
        "enabled": false,
        "template": "سلام [نام کاربر]، مبلغ [مبلغ تراکنش] تومان از حساب شما برداشت شد."
    },
    "verifiedUsers": {
        "enabled": false,
        "template": "سلام [نام کاربر] عزیز، پیام شما..."
    },
    "unverifiedUsers": {
        "enabled": false,
        "template": "کاربر گرامی، لطفا احراز هویت خود را تکمیل کنید."
    }
}
```

### 2. بروزرسانی تنظیمات پیامک
```
PUT /settings/sms
Authorization: Bearer {token}
Roles: SuperAdmin, Admin
Content-Type: application/json
```

**Request Body:**
```json
{
    "registration": {
        "enabled": true,
        "template": "سلام [نام کاربر]، خوش آمدید!"
    },
    "deposit": {
        "enabled": true,
        "template": "مبلغ [مبلغ تراکنش] تومان به حساب شما واریز شد."
    }
}
```

## استفاده در کد

### 1. ارسال پیامک ثبت نام
```javascript
// در auth service یا user service
constructor(private smsService: SmsService) {}

async register(userData) {
    const user = await this.createUser(userData);
    
    // ارسال پیامک خوش آمدگویی
    await this.smsService.sendRegistrationSMS(user);
    
    return user;
}
```

### 2. ارسال پیامک واریز
```javascript
// در balance-transaction service
async createDeposit(user, amount) {
    const transaction = await this.create({ user, amount, type: 'Deposit' });
    
    // ارسال پیامک واریز
    await this.smsService.sendDepositSMS(user, transaction);
    
    return transaction;
}
```

### 3. ارسال پیامک برداشت
```javascript
// در balance-transaction service
async createWithdrawal(user, amount) {
    const transaction = await this.create({ user, amount, type: 'Withdrawal' });
    
    // ارسال پیامک برداشت
    await this.smsService.sendWithdrawalSMS(user, transaction);
    
    return transaction;
}
```

### 4. ارسال پیامک گروهی به کاربران احراز شده
```javascript
// مثال استفاده
await this.smsService.sendToVerifiedUsers(this.userModel);
```

### 5. ارسال پیامک گروهی به کاربران احراز نشده
```javascript
// مثال استفاده
await this.smsService.sendToUnverifiedUsers(this.userModel);
```

## شورتکات های موجود

### برای پیامک ثبت نام:
- `[نام کاربر]` - نام کاربر
- `[نام خانوادگی]` - نام خانوادگی
- `[شماره موبایل]` - شماره موبایل

### برای پیامک واریز/برداشت:
- `[نام کاربر]` - نام کاربر
- `[مبلغ تراکنش]` - مبلغ تراکنش (با فرمت فارسی)
- `[موجودی]` - موجودی فعلی (با فرمت فارسی)
- `[تاریخ]` - تاریخ تراکنش (شمسی)

### برای پیامک های گروهی:
- `[نام کاربر]` - نام کاربر
- `[نام خانوادگی]` - نام خانوادگی
- `[شماره موبایل]` - شماره موبایل

## تنظیمات Kavenegar

اطلاعات Kavenegar در فایل `sms/sms.service.js` قرار دارد:

```javascript
this.api = Kavenegar.KavenegarApi({
    apikey: 'YOUR_API_KEY_HERE'
});
this.sender = 'YOUR_SENDER_NUMBER';
```

برای تغییر API Key یا شماره ارسال کننده، این مقادیر را ویرایش کنید.

## نکات مهم

1. **خطاها**: تمام خطاهای ارسال پیامک در console لاگ می‌شوند و برنامه را متوقف نمی‌کنند
2. **Async**: تمام متدها async هستند و می‌توانید از await استفاده کنید
3. **Database**: تنظیمات در collection `smssettings` ذخیره می‌شود
4. **Default Values**: اگر تنظیمات وجود نداشته باشد، به صورت خودکار ایجاد می‌شود

## مثال کامل Integration

```javascript
const { Module, forwardRef } = require('@nestjs/common');
const { SmsModule } = require('../sms/sms.module');

@Module({
    imports: [
        forwardRef(() => SmsModule)
    ],
    // ...
})
class YourModule {}
```

## تست

برای تست ارسال پیامک:

```bash
curl -X POST http://localhost:3003/settings/sms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "registration": {
        "enabled": true,
        "template": "تست پیامک"
    }
}'
```

سپس یک کاربر جدید ثبت نام کنید و پیامک باید ارسال شود.
