# 📱 راهنمای راه‌اندازی سرویس SMS مستقل

## 🎯 چرا این روش؟

چون `main.js` obfuscated هست و نمی‌تونیم بهش route اضافه کنیم، یک **سرور مستقل** برای SMS می‌سازیم که:

✅ **امن**: API Key رو expose نمی‌کنه  
✅ **مستقل**: از main.js جدا کار می‌کنه  
✅ **قابل گسترش**: راحت می‌تونی قابلیت اضافه کنی  
✅ **قابل نگهداری**: Log و Monitor داره  

---

## 🚀 نصب و راه‌اندازی

### 1. چک کردن Dependencies

```bash
cd /Users/faraz/Desktop/Repo/Back/mehrsungold-backend

# اگه kavenegar نصب نیست:
npm install kavenegar --save
```

### 2. تنظیم Environment Variables

در فایل `.env` اضافه کن:

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/mehrsungold

# SMS Service Port
SMS_PORT=3005

# Kavenegar (optional - در sms.service.js هست)
KAVENEGAR_API_KEY=your_key_here
KAVENEGAR_SENDER=10018018949161
```

### 3. راه‌اندازی سرویس

```bash
# Development
node sms-standalone-server.js

# Production با PM2
pm2 start sms-standalone-server.js --name sms-service
pm2 save
```

---

## 📡 Endpoints

### Health Check
```bash
GET http://localhost:3005/health
```

### دریافت تنظیمات SMS
```bash
GET http://localhost:3005/settings/sms
Authorization: Bearer YOUR_TOKEN
```

### ذخیره تنظیمات SMS
```bash
PUT http://localhost:3005/settings/sms
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "registration": {
    "enabled": true,
    "templateName": "gold-register",
    "tokens": {
      "token": "نام کاربر",
      "token2": "نام خانوادگی"
    }
  },
  "deposit": {
    "enabled": true,
    "templateName": "gold-deposit",
    "tokens": {}
  }
}
```

### ارسال پیامک ثبت نام
```bash
POST http://localhost:3005/sms/send/registration
Content-Type: application/json

{
  "mobileNumber": "09120315101"
}
```

### ارسال پیامک واریز
```bash
POST http://localhost:3005/sms/send/deposit
Content-Type: application/json

{
  "mobileNumber": "09120315101",
  "amount": 1000000
}
```

### ارسال پیامک برداشت
```bash
POST http://localhost:3005/sms/send/withdrawal
Content-Type: application/json

{
  "mobileNumber": "09120315101",
  "amount": 500000
}
```

### ارسال پیامک گروهی
```bash
POST http://localhost:3005/sms/send/bulk
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "recipients": ["09120315101", "09121234567"],
  "templateType": "verified"
}
```

---

## 🔗 یکپارچه‌سازی با Frontend

### 1. تنظیم Base URL

در frontend، یک environment variable اضافه کن:

```env
# .env.local
NEXT_PUBLIC_SMS_API_URL=http://localhost:3005
# یا برای production:
NEXT_PUBLIC_SMS_API_URL=https://sms.mehrsun.gold
```

### 2. ارسال SMS بعد از ثبت نام

در component ثبت نام:

```javascript
// بعد از ثبت نام موفق
const handleRegistration = async (userData) => {
    try {
        // 1. ثبت نام کاربر
        const result = await ApiCall('/auth/register', 'POST', locale, userData, '', 'public', router);
        
        if (result.statusCode === 201) {
            // 2. ارسال پیامک خوش‌آمدگویی (async - don't wait)
            fetch(`${process.env.NEXT_PUBLIC_SMS_API_URL}/sms/send/registration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    mobileNumber: userData.mobileNumber 
                })
            }).catch(err => console.error('SMS send failed:', err));
            
            // 3. ادامه فرآیند
            router.push('/panel');
        }
    } catch (error) {
        console.error(error);
    }
};
```

### 3. ارسال SMS بعد از واریز/برداشت

در component تراکنش‌ها:

```javascript
// بعد از تایید واریز
const handleApproveDeposit = async (transaction) => {
    try {
        // 1. تایید تراکنش
        await ApiCall(`/transaction/${transaction._id}/approve`, 'PUT', ...);
        
        // 2. ارسال پیامک
        fetch(`${process.env.NEXT_PUBLIC_SMS_API_URL}/sms/send/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                mobileNumber: transaction.user.mobileNumber,
                amount: transaction.amount
            })
        }).catch(err => console.error('SMS send failed:', err));
        
    } catch (error) {
        console.error(error);
    }
};
```

---

## 🔒 امنیت

### محافظت با Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/sms.mehrsun.gold

server {
    listen 80;
    server_name sms.mehrsun.gold;

    # فقط از IP های مشخص اجازه دسترسی
    allow YOUR_FRONTEND_SERVER_IP;
    deny all;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### یا با Firewall

```bash
# فقط Frontend Server بتونه به port 3005 دسترسی داشته باشه
sudo ufw allow from YOUR_FRONTEND_IP to any port 3005
```

---

## 📊 Monitoring

### لاگ‌ها
```bash
# PM2 logs
pm2 logs sms-service

# یا اگه مستقیم اجرا کردی:
node sms-standalone-server.js 2>&1 | tee sms-service.log
```

### Health Check با Cron
```bash
# هر 5 دقیقه چک کن سرویس زنده‌است
*/5 * * * * curl -f http://localhost:3005/health || pm2 restart sms-service
```

---

## 🧪 تست

```bash
# تست health
curl http://localhost:3005/health

# تست ارسال پیامک
curl -X POST http://localhost:3005/sms/send/registration \
  -H "Content-Type: application/json" \
  -d '{"mobileNumber":"09120315101"}'
```

---

## 🎨 گسترش قابلیت‌ها

### اضافه کردن SMS جدید

1. در `sms.service.js` یک متد جدید بساز:
```javascript
async sendCustomSMS(user, data) {
    const settings = await this.getSettings();
    if (!settings.custom?.enabled) return;
    
    await this.sendSMS(
        user.mobileNumber, 
        settings.custom.templateName, 
        settings.custom.tokens
    );
}
```

2. در `sms-standalone-server.js` endpoint اضافه کن:
```javascript
app.post('/sms/send/custom', async (req, res) => {
    const { mobileNumber, data } = req.body;
    await smsService.sendCustomSMS({ mobileNumber }, data);
    res.json({ statusCode: 200, message: 'SMS sent' });
});
```

3. از frontend صدا بزن!

---

## 🐛 Troubleshooting

### سرویس start نمیشه
```bash
# چک کن MongoDB در دسترس هست
mongo --eval "db.version()"

# چک کن port 3005 خالی هست
lsof -i :3005
```

### پیامک ارسال نمیشه
```bash
# چک کن تنظیمات در دیتابیس
mongo mehrsungold --eval "db.smssettings.find().pretty()"

# چک کن API Key معتبر هست
# در sms/sms.service.js خط 25
```

### Frontend نمیتونه به سرویس وصل بشه
```bash
# اگه CORS error میده، در sms-standalone-server.js:
app.use(cors({
    origin: ['http://localhost:3000', 'https://panel.mehrsun.gold'],
    credentials: true
}));
```

---

## ✅ مزایای این روش

1. ✅ **مستقل از main.js obfuscated**
2. ✅ **امن - API Key در backend**
3. ✅ **قابل گسترش - راحت endpoint اضافه می‌کنی**
4. ✅ **Log و Monitor داره**
5. ✅ **می‌تونی bulk SMS اضافه کنی**
6. ✅ **می‌تونی scheduling اضافه کنی**
7. ✅ **می‌تونی تاریخچه ذخیره کنی**

---

## 📝 نکات مهم

- ⚠️  این سرویس باید **همیشه running** باشه
- ⚠️  از **PM2** برای production استفاده کن
- ⚠️  **Nginx** یا **Firewall** برای امنیت
- ⚠️  **Log rotation** رو فراموش نکن
- ⚠️  **Health check** رو setup کن

---

## 🚀 Deploy در Production

```bash
# 1. Clone و setup
cd /app
git pull origin feature/users-sort-toman

# 2. Install deps
npm install

# 3. Start با PM2
pm2 start sms-standalone-server.js --name sms-service
pm2 startup
pm2 save

# 4. Check status
pm2 status
pm2 logs sms-service

# 5. Test
curl http://localhost:3005/health
```

---

**نتیجه**: با این روش، تمام مشکلات obfuscated main.js رو دور زدیم و یک سیستم SMS کامل، امن، و قابل گسترش داریم! 🎉
