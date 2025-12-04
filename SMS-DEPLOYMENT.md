# 📱 SMS System Deployment Guide

## Overview
این سیستم به صورت خودکار پیامک‌های زیر را ارسال می‌کند:
- ✅ پیامک خوش‌آمدگویی بعد از ثبت‌نام
- ✅ پیامک واریز
- ✅ پیامک برداشت
- ✅ پیامک گروهی به کاربران احراز شده
- ✅ پیامک گروهی به کاربران احراز نشده

---

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
npm install kavenegar --save
```

### 2. Environment Variables
در فایل `.env` موارد زیر را اضافه کنید:

```env
# Kavenegar SMS Configuration
KAVENEGAR_API_KEY=your_api_key_here
KAVENEGAR_SENDER=10018018949161
```

### 3. Run Application
```bash
# Development
node main-enhanced.js

# Production
pm2 start main-enhanced.js --name mehrsungold-backend
```

---

## 📁 File Structure

```
mehrsungold-backend/
├── main.js                    # Obfuscated main file (don't edit)
├── main-enhanced.js           # Enhanced main with SMS features
├── sms-hooks.js               # Automatic SMS hooks (NEW)
├── sms-proxy-setup.js         # SMS proxy for admin panel
├── test-sms-endpoint.js       # SMS test endpoint (port 3004)
├── sms/
│   ├── sms.service.js         # SMS service with Kavenegar
│   ├── sms.controller.js      # SMS controller (obfuscated)
│   └── sms.module.js          # SMS module (obfuscated)
└── settings/
    └── settings-sms.controller.js  # SMS settings controller
```

---

## 🔧 How It Works

### Automatic SMS on Registration
فایل `sms-hooks.js` به صورت middleware عمل می‌کند و:

1. تمام response های route `/auth/register` را intercept می‌کند
2. اگر ثبت‌نام موفق بود (status 201)
3. شماره موبایل را extract می‌کند
4. به صورت async پیامک خوش‌آمدگویی ارسال می‌کند

```javascript
// Example: sms-hooks.js
function registrationSmsHook(req, res, next) {
    const originalJson = res.json.bind(res);
    
    res.json = async function(data) {
        if (req.path === '/auth/register' && res.statusCode === 201) {
            const mobileNumber = req.body?.mobileNumber;
            if (mobileNumber) {
                await smsService.sendRegistrationSMS({ mobileNumber });
            }
        }
        return originalJson(data);
    };
    next();
}
```

---

## 🎛️ Admin Panel Configuration

### Access SMS Settings
```
URL: http://localhost:3000/admin/panel/settings/sms
```

### Configure Templates
برای هر نوع پیامک:
1. ✅ فعال/غیرفعال کردن
2. 📝 نام الگوی کاوه‌نگار (Template Name)
3. 🔑 توکن‌های الگو (token, token2, token3)

**مثال:**
```json
{
  "registration": {
    "enabled": true,
    "templateName": "gold-register",
    "tokens": {
      "token": "نام کاربر",
      "token2": "کد معرف",
      "token3": "لینک سایت"
    }
  }
}
```

---

## 🧪 Testing

### Test Registration SMS
```bash
curl -X POST http://localhost:3004/test/sms/registration \
  -H "Content-Type: application/json" \
  -d '{"mobileNumber":"09120315101"}'
```

### Test via Real Registration
```bash
curl -X POST http://localhost:3003/auth/register \
  -H "Content-Type: application/json" \
  -d '{"mobileNumber":"09120315101"}'
```

---

## 📦 Git & Production Deployment

### 1. Git Ignore
مطمئن شوید `.env` در `.gitignore` است:

```gitignore
# Environment variables
.env
.env.local
.env.production

# Logs
/tmp/*.log
```

### 2. Push to GitHub
```bash
git add .
git commit -m "Add automatic SMS system with hooks"
git push origin main
```

### 3. Production Server Setup

#### A. Clone Repository
```bash
git clone https://github.com/your-username/mehrsungold-backend.git
cd mehrsungold-backend
```

#### B. Install Dependencies
```bash
npm install
```

#### C. Configure Environment
```bash
nano .env
# Add production values:
# - KAVENEGAR_API_KEY
# - KAVENEGAR_SENDER
# - MongoDB connection
# - etc.
```

#### D. Start with PM2
```bash
pm2 start main-enhanced.js --name mehrsungold-backend
pm2 start test-sms-endpoint.js --name sms-endpoint

# Enable auto-start on reboot
pm2 startup
pm2 save
```

---

## 🔍 Monitoring & Logs

### View Logs
```bash
# Backend logs
pm2 logs mehrsungold-backend

# SMS endpoint logs
pm2 logs sms-endpoint

# Or check file logs
tail -f /tmp/backend.log
tail -f /tmp/sms-endpoint.log
```

### Check SMS Hook Status
```bash
# Should see this in logs:
[SMS Hooks] Initializing automatic SMS hooks...
[SMS Hooks] Registration SMS hook activated
[Main Enhanced] SMS Proxy and Hooks added to application
```

---

## 🐛 Troubleshooting

### Problem: SMS not sending on registration
**Check:**
1. ✅ آیا `main-enhanced.js` اجرا شده؟ (نه `main.js`)
2. ✅ آیا در admin panel، registration SMS فعال است؟
3. ✅ آیا `templateName` صحیح تنظیم شده؟
4. ✅ آیا `KAVENEGAR_API_KEY` معتبر است؟

**Debug:**
```bash
# Check logs for SMS hook activity
tail -f /tmp/backend.log | grep "SMS Hook"

# Should see:
[SMS Hook] Registration detected for: 09120315101
[SMS Hook] Welcome SMS sent to: 09120315101
```

### Problem: SMS settings not saving
**Check:**
1. MongoDB connection
2. Collection `smssettings` exists
3. Admin authentication token valid

---

## 🔐 Security Notes

### API Key Protection
- ❌ Never commit `.env` to Git
- ✅ Use environment variables in production
- ✅ Rotate API keys regularly

### Template Validation
- SMS system validates required fields
- Prevents sending if template disabled
- Logs all SMS activities

---

## 📊 Features Summary

| Feature | Status | Port | Description |
|---------|--------|------|-------------|
| Automatic Registration SMS | ✅ | 3003 | Sends welcome SMS on signup |
| Manual SMS Test | ✅ | 3004 | Test endpoint for SMS |
| Admin Panel Settings | ✅ | 3000 | Configure SMS templates |
| Dashboard Analytics | ✅ | 3004 | Weekly gold/silver trading stats |
| User Referrer Display | ✅ | 3000 | Show referrer info on user page |

---

## 📞 Support

اگر مشکلی پیش آمد:
1. لاگ‌ها را بررسی کنید
2. مطمئن شوید همه environment variables تنظیم شده‌اند
3. API key کاوه‌نگار را در پنل آن‌ها چک کنید

---

**Last Updated:** December 4, 2025  
**Version:** 1.0.0
