# مراحل دیپلوی پروداکشن - SMS System

## ✅ کارهایی که انجام شد:
1. ✅ فایل‌های env فرانت و بک‌اند آپدیت شدن
2. ✅ کد‌ها به GitHub پوش شدن
3. ✅ Nginx کانفیگ شد و reload شد

## 🔄 مراحل باقی‌مانده:

### 1️⃣ Pull کردن کد جدید از GitHub

**بک‌اند (توی شل سرور):**
```bash
cd /app
git pull origin main
npm install
```

**فرانت (اگه روی همون سرور هست):**
```bash
cd /path/to/frontend
git pull origin feature/users-sort-toman
npm install
npm run build
```

### 2️⃣ اضافه کردن فایل .env به بک‌اند

فایل `.env` که توی `/Users/faraz/Desktop/env files/.env` هست رو باید به سرور منتقل کنی:

```bash
# از کامپیوتر محلی:
scp "/Users/faraz/Desktop/env files/.env" user@server:/app/.env

# یا اگه دسترسی مستقیم نداری، محتوای فایل رو کپی کن و توی سرور بساز:
cat > /app/.env << 'EOF'
PORT=4001
MONGO_URI=mongodb://root:hg8XuxScCylaVcnI@services.irn2.chabokan.net:13749/gold?authSource=admin
SMS_PORT=3005
EOF
```

### 3️⃣ استارت کردن SMS Service

دو روش برای استارت:

**روش 1: استفاده از PM2 (پیشنهادی)**
```bash
cd /app

# استارت هر دو سرویس با PM2
npm install -g pm2
pm2 start ecosystem.config.js

# چک کردن وضعیت
pm2 status
pm2 logs sms-service

# ذخیره برای autostart
pm2 save
pm2 startup
```

**روش 2: استارت دستی (موقت)**
```bash
cd /app
node sms-standalone-server.js > sms.log 2>&1 &
```

### 4️⃣ تست کردن

**تست SMS Service:**
```bash
# تست مستقیم
curl http://localhost:3005/health

# تست از طریق Nginx
curl http://localhost:4001/sms/health

# تست از بیرون
curl https://gateway.mehrsun.gold/sms/health
```

**تست ارسال SMS:**
```bash
curl -X POST http://localhost:4001/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "09123456789",
    "message": "تست سیستم SMS"
  }'
```

### 5️⃣ مانیتورینگ

**چک کردن لاگ‌ها:**
```bash
# لاگ PM2
pm2 logs sms-service --lines 100

# یا لاگ فایل
tail -f /app/sms.log

# لاگ Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

**چک کردن پروسس‌ها:**
```bash
ps aux | grep node
pm2 status
```

## 🔧 استفاده از PM2 (پیشنهادی)

فایل `ecosystem.config.js` آماده هست:

```javascript
module.exports = {
  apps: [
    {
      name: 'backend-main',
      script: 'main-enhanced.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 4001
      }
    },
    {
      name: 'sms-service',
      script: 'sms-standalone-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        SMS_PORT: 3005
      }
    }
  ]
};
```

**دستورات PM2:**
```bash
pm2 start ecosystem.config.js       # استارت همه
pm2 restart all                     # ری‌استارت همه
pm2 stop sms-service                # متوقف کردن SMS
pm2 delete sms-service              # حذف از لیست
pm2 logs sms-service                # نمایش لاگ
pm2 monit                           # مانیتورینگ real-time
```

## 📊 پورت‌های استفاده شده

- **4001**: Nginx (ورودی اصلی از بیرون)
  - `/` → Backend Main (پورت 4000)
  - `/dashboard` → Dashboard Service (پورت 3004)
  - `/sms` → SMS Service (پورت 3005)
- **4000**: Backend اصلی (NestJS)
- **3004**: Dashboard Service (Express)
- **3005**: SMS Service (Express + Scheduler)

## ⚠️ نکات مهم

1. **فایل .env** نباید به git push بشه (توی .gitignore هست)
2. **Kavenegar API Key** رو باید توی .env اضافه کنی
3. **MongoDB** باید در دسترس باشه (الان روی Chabokan هست)
4. **SMS Service** باید قبل از استفاده فرانت استارت بشه

## 🚀 خلاصه دستورات سریع

```bash
# 1. Pull و Install
cd /app && git pull origin main && npm install

# 2. چک کردن .env
cat /app/.env

# 3. استارت با PM2
pm2 start ecosystem.config.js

# 4. چک وضعیت
pm2 status
curl http://localhost:4001/sms/health

# 5. مانیتورینگ
pm2 logs --lines 50
```

## 🎯 چک‌لیست نهایی

- [ ] کد از GitHub pull شد
- [ ] npm install اجرا شد
- [ ] فایل .env در مسیر /app وجود داره
- [ ] SMS Service با PM2 استارت شد
- [ ] تست health endpoint موفق بود
- [ ] تست ارسال SMS موفق بود
- [ ] لاگ‌ها بدون خطا هستن

---

**در صورت بروز مشکل:**
- لاگ‌ها رو چک کن: `pm2 logs sms-service`
- پروسس‌ها رو چک کن: `pm2 status`
- Nginx رو ری‌استارت کن: `nginx -s reload`
- SMS Service رو ری‌استارت کن: `pm2 restart sms-service`
