# راهنمای دیپلوی دستی (بدون Git)

چون سرور دسترسی Git نداره، باید فایل‌ها رو دستی کپی کنی.

## فایل‌های جدید که باید به سرور منتقل بشن:

### 1. فایل‌های SMS (پوشه sms/)
```
/app/sms/scheduled-sms.controller.js
/app/sms/scheduled-sms.service.js
/app/sms/sms-scheduler.js
/app/sms/schema/scheduled-sms.schema.js
/app/sms/schema/sms-log.schema.js
```

### 2. فایل اصلی SMS Standalone
```
/app/sms-standalone-server.js
```

### 3. فایل کانفیگ PM2
```
/app/ecosystem.config.js
```

### 4. فایل .env
```
/app/.env
```

## روش انتقال فایل‌ها:

### گزینه 1: استفاده از پنل چابکان (راحت‌ترین)
1. برو به پنل چابکان
2. بخش Files یا File Manager رو پیدا کن
3. فایل‌ها رو آپلود کن

### گزینه 2: استفاده از SCP (اگه دسترسی داری)
```bash
# از کامپیوتر محلی:
scp -r /Users/faraz/Desktop/Repo/Back/mehrsungold-backend/sms user@server:/app/
scp /Users/faraz/Desktop/Repo/Back/mehrsungold-backend/sms-standalone-server.js user@server:/app/
scp /Users/faraz/Desktop/Repo/Back/mehrsungold-backend/ecosystem.config.js user@server:/app/
scp "/Users/faraz/Desktop/env files/.env" user@server:/app/
```

### گزینه 3: کپی دستی محتوا (اگه دسترسی shell داری)
برای هر فایل، محتوا رو کپی کن و توی سرور بساز.

## مثال: ساخت فایل ecosystem.config.js

توی شل سرور:
```bash
cat > /app/ecosystem.config.js << 'EOF'
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
EOF
```

## بعد از کپی فایل‌ها:

```bash
# 1. نصب dependencies جدید
cd /app
npm install node-cron cron-parser date-fns

# 2. چک کردن فایل .env
cat /app/.env

# 3. استارت SMS Service
pm2 start ecosystem.config.js

# 4. چک کردن وضعیت
pm2 status
pm2 logs sms-service

# 5. تست
curl http://localhost:3005/health
curl http://localhost:4001/sms/health
```

## چک‌لیست فایل‌های مورد نیاز:

- [ ] /app/sms/scheduled-sms.controller.js
- [ ] /app/sms/scheduled-sms.service.js  
- [ ] /app/sms/sms-scheduler.js
- [ ] /app/sms/schema/scheduled-sms.schema.js
- [ ] /app/sms/schema/sms-log.schema.js
- [ ] /app/sms-standalone-server.js (آپدیت شده)
- [ ] /app/ecosystem.config.js
- [ ] /app/.env
- [ ] Dependencies نصب شدن (node-cron, cron-parser, date-fns)

## اگه پنل چابکان رو داری:
بهترین راه این هست که یک فایل ZIP بسازیم و از پنل آپلود کنی.
