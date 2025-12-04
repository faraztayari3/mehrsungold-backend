# راهنمای استقرار Backend

## 📦 معماری

Backend شما از **دو سرویس جداگانه** تشکیل شده:

### 1️⃣ Backend اصلی (`main.js`)
- **پورت**: 3003
- **محتوا**: همه endpoint های اصلی (auth, user, transaction, ...)
- **فایل**: `main.js` (obfuscated - قابل تغییر نیست)
- **اجرا**: `npm start` یا `node main.js`

### 2️⃣ SMS & Dashboard Service (`test-sms-endpoint.js`)
- **پورت**: 3004
- **محتوا**: 
  - `/settings/sms` - مدیریت تنظیمات SMS
  - `/dashboard/weekly-metals` - آمار هفتگی طلا و نقره
  - `/test/sms/*` - endpoint های تست SMS
- **فایل**: `test-sms-endpoint.js`
- **اجرا**: `node test-sms-endpoint.js`

---

## 🚀 نحوه اجرا

### در سرور Development (لوکال):

```bash
# Terminal 1: Backend اصلی
cd /Users/faraz/Desktop/Repo/Back/mehrsungold-backend
node main.js > /tmp/backend.log 2>&1 &

# Terminal 2: SMS Service
cd /Users/faraz/Desktop/Repo/Back/mehrsungold-backend
node test-sms-endpoint.js > /tmp/sms-endpoint.log 2>&1 &
```

### در سرور Production:

با PM2:

```bash
# Backend اصلی
pm2 start main.js --name backend

# SMS Service
pm2 start test-sms-endpoint.js --name dashboard-api

# ذخیره تنظیمات
pm2 save

# Auto-start on reboot
pm2 startup
```

---

## 🌐 پیکربندی nginx

در سرور production، nginx باید درخواست‌ها را به سرویس مناسب هدایت کند:

```nginx
# Backend اصلی - همه endpoint ها
location / {
    proxy_pass http://localhost:3003;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

# SMS & Dashboard Service
location /settings/sms {
    proxy_pass http://localhost:3004;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location /dashboard/ {
    proxy_pass http://localhost:3004;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

بعد از تغییر:
```bash
nginx -t  # تست کانفیگ
nginx -s reload  # reload
```

---

## ✅ چرا این روش؟

### مزایا:
- ✅ `main.js` اصلی دست نخورده میمونه (obfuscated - قابل تغییر نیست)
- ✅ SMS و Dashboard مستقل و قابل debug
- ✅ اگر یکی کرش کرد، دیگری کار میکنه
- ✅ راحت میتونی SMS service رو update کنی
- ✅ هر سرویس لاگ جداگانه داره

### معایب:
- ❌ دو سرویس باید اجرا بشن
- ❌ nginx باید پیکربندی شود

---

## 🔍 تست

### تست Backend اصلی:
```bash
curl http://localhost:3003/user
```

### تست SMS Service:
```bash
# Dashboard
curl http://localhost:3004/dashboard/weekly-metals

# SMS Settings
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3004/settings/sms
```

### تست از طریق Gateway (Production):
```bash
# Backend اصلی
curl https://gateway.mehrsun.gold/user

# Dashboard
curl https://gateway.mehrsun.gold/dashboard/weekly-metals

# SMS
curl -H "Authorization: Bearer YOUR_TOKEN" https://gateway.mehrsun.gold/settings/sms
```

---

## 📂 فایل‌های مهم

- `main.js` - Backend اصلی (obfuscated)
- `test-sms-endpoint.js` - SMS & Dashboard Service
- `sms-routes.js` - Route handlers (استفاده شده در test-sms-endpoint.js)
- `sms/` - پوشه سرویس SMS
- `main-enhanced.js` - **استفاده نمیشود** (monkey patch کار نکرد)

---

## 🔄 Update کردن

### Backend اصلی:
```bash
# دریافت main.js جدید از منبع
# سپس restart
pm2 restart backend
```

### SMS Service:
```bash
git pull origin main
pm2 restart dashboard-api
```

---

## 🐛 عیب‌یابی

### لاگ‌ها:
```bash
# PM2
pm2 logs backend
pm2 logs dashboard-api

# یا فایل‌های لاگ
tail -f /tmp/backend.log
tail -f /tmp/sms-endpoint.log
```

### بررسی پورت‌ها:
```bash
lsof -i :3003  # Backend
lsof -i :3004  # SMS Service
```

### بررسی وضعیت PM2:
```bash
pm2 list
pm2 status
```
