# 🏆 Mehrsungold Backend

Backend API for Mehrsungold gold trading platform built with **NestJS** and **MongoDB**.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB
- npm or yarn

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd mehrsungold-backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your values
```

### Run Development Server

```bash
# Run with SMS hooks
node main-enhanced.js

# Or run SMS test endpoint separately
node test-sms-endpoint.js
```

**Ports:**
- Main API: `3003`
- SMS/Dashboard: `3004`

---

## 📁 Project Structure

```
mehrsungold-backend/
├── main.js                     # Obfuscated main (production)
├── main-enhanced.js            # Enhanced with SMS hooks
├── app.module.js               # Root module
├── app.controller.js           # Root controller
├── app.service.js              # Root service
│
├── auth/                       # Authentication module
│   ├── auth.controller.js
│   ├── auth.service.js
│   └── dto/
│
├── user/                       # User management
│   ├── user.controller.js
│   ├── user.service.js
│   └── schema/
│
├── transaction/                # Trading transactions
├── balance-transaction/        # Balance operations
├── gift-card/                  # Gift card system
├── product/                    # Product management
├── order-book/                 # Order book system
├── stake/                      # Staking system
│
├── sms/                        # SMS module
│   ├── sms.service.js         # Kavenegar integration
│   ├── sms.controller.js
│   └── sms.module.js
│
├── sms-hooks.js               # Automatic SMS triggers
├── sms-proxy-setup.js         # SMS proxy for admin
├── test-sms-endpoint.js       # SMS testing (port 3004)
│
├── settings/                  # Platform settings
├── logger/                    # Winston logger
├── common/                    # Shared utilities
└── external-apis/             # External API integrations
```

---

## 🔧 Environment Variables

Create `.env` file:

```env
# Application
NODE_ENV=development
PORT=3003

# Database
DATABASE_URI=mongodb://user:pass@host:port/dbname?authSource=admin

# JWT
JWT_ACCESS_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# SMS - Kavenegar
KAVENEGAR_API_KEY=your-kavenegar-api-key
KAVENEGAR_SENDER=10018018949161

# External APIs
MELIPAYAMAK_USERNAME=your-username
MELIPAYAMAK_PASSWORD=your-password
```

---

## 📱 SMS System

### Features
- ✅ Automatic welcome SMS on registration
- ✅ Deposit/withdrawal notifications
- ✅ Bulk SMS to verified/unverified users
- ✅ Template-based messaging (Kavenegar Lookup)
- ✅ Admin panel configuration

### Setup Guide
See [SMS-DEPLOYMENT.md](./SMS-DEPLOYMENT.md) for detailed setup instructions.

### Quick Test
```bash
# Test registration SMS
curl -X POST http://localhost:3004/test/sms/registration \
  -H "Content-Type: application/json" \
  -d '{"mobileNumber":"09120315101"}'
```

---

## 🎯 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login/otp` - Request OTP
- `POST /auth/login/otp-verify` - Verify OTP
- `POST /auth/login/password` - Password login
- `POST /auth/refresh-tokens` - Refresh tokens
- `POST /auth/logout` - Logout

### User Management
- `GET /user` - Get users (admin)
- `GET /user/:id` - Get user by ID
- `PATCH /user/:id` - Update user
- `DELETE /user/:id` - Delete user

### Transactions
- `GET /transaction` - List transactions
- `POST /transaction` - Create transaction
- `GET /transaction/:id` - Get transaction details

### SMS (Admin)
- `GET /settings/sms` - Get SMS settings
- `PUT /settings/sms` - Update SMS settings
- `POST /sms/send/verified` - Send to verified users
- `POST /sms/send/unverified` - Send to unverified users

### Dashboard (Port 3004)
- `GET /dashboard/weekly-metals` - Weekly gold/silver stats
- `POST /test/sms/registration` - Test registration SMS

---

## 🗄️ Database

### MongoDB Collections
- `users` - User accounts
- `transactions` - Trading transactions
- `balancetransactions` - Balance operations
- `tradeables` - Gold, Silver, USDT
- `products` - Product listings
- `giftcards` - Gift card system
- `stakes` - Staking records
- `smssettings` - SMS configuration
- `tickets` - Support tickets

---

## 🔐 Security

### Authentication
- JWT-based authentication
- Access & Refresh token strategy
- Role-based access control (Admin, User, VIPUser)

### Best Practices
- ❌ Never commit `.env` files
- ✅ Use environment variables
- ✅ Keep API keys secure
- ✅ Validate all inputs
- ✅ Use HTTPS in production

---

## 🚢 Deployment

### Production Setup

1. **Server Requirements**
   - Node.js 18+
   - PM2 process manager
   - MongoDB 5+
   - Nginx (reverse proxy)

2. **Install PM2**
```bash
npm install -g pm2
```

3. **Start Services**
```bash
# Main backend
pm2 start main-enhanced.js --name mehrsungold-backend

# SMS endpoint
pm2 start test-sms-endpoint.js --name sms-endpoint

# Enable auto-restart
pm2 startup
pm2 save
```

4. **Nginx Configuration**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

5. **SSL/TLS**
```bash
certbot --nginx -d api.yourdomain.com
```

---

## 📊 Monitoring

### PM2 Monitoring
```bash
# View logs
pm2 logs mehrsungold-backend

# Monitor processes
pm2 monit

# Restart
pm2 restart mehrsungold-backend
```

### Health Check
```bash
# Check backend
curl http://localhost:3003

# Check SMS endpoint
curl http://localhost:3004/dashboard/weekly-metals
```

---

## 🧪 Testing

```bash
# Run tests
npm test

# Test coverage
npm run test:cov
```

---

## 📝 Development Notes

### Code Obfuscation
Some files are obfuscated for production:
- `main.js` - Main entry point
- `auth/*` - Authentication module
- `user/*` - User module

Use `main-enhanced.js` for development with SMS hooks.

### Adding New Features
1. Create module: `nest g module feature`
2. Create controller: `nest g controller feature`
3. Create service: `nest g service feature`
4. Add to `app.module.js`

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📄 License

This project is proprietary and confidential.

---

## 📞 Support

For issues or questions:
- Check [SMS-DEPLOYMENT.md](./SMS-DEPLOYMENT.md)
- Review logs: `pm2 logs` or `/tmp/*.log`
- Contact development team

---

**Version:** 1.0.0  
**Last Updated:** December 4, 2025
