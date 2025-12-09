# SMS Standalone Server - Production Deployment Guide

## Overview
The SMS service runs as a standalone Express server on port 3006 (or configured SMS_PORT), separate from the main obfuscated backend.

## Prerequisites
- Node.js 18+ installed
- PM2 installed globally: `npm install -g pm2`
- MongoDB accessible
- Kavenegar API key configured

## Environment Setup

### Backend .env.production
```env
NODE_ENV=production
SMS_PORT=3006
MONGO_URI=mongodb://user:pass@host:port/dbname?authSource=admin
KAVENEGAR_API_KEY=your_api_key_here
KAVENEGAR_SENDER=20006000646
```

### Frontend .env.production
```env
NEXT_PUBLIC_SMS_API_URL=https://gateway.mehrsun.gold
```

## Deployment Steps

### 1. Backend SMS Service

```bash
cd /path/to/mehrsungold-backend

# Install dependencies (if not done)
npm install

# Start with PM2 using ecosystem config
pm2 start ecosystem.config.js --only sms-standalone

# Or start manually
SMS_PORT=3006 NODE_ENV=production pm2 start sms-standalone-server.js --name sms-standalone

# Check status
pm2 status
pm2 logs sms-standalone

# Save PM2 config to start on reboot
pm2 save
pm2 startup
```

### 2. Nginx Proxy Configuration

Add to your nginx config to proxy SMS requests:

```nginx
# SMS Service (port 3006)
location /sms/ {
    proxy_pass http://localhost:3006/sms/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

# SMS Settings endpoint
location /settings/sms {
    proxy_pass http://localhost:3006/settings/sms;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Test and reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Frontend Build & Deploy

```bash
cd /path/to/Mehrsungold

# Build with production env
npm run build

# Start with PM2
pm2 start npm --name "frontend" -- start

# Or use ecosystem config if you create one for frontend
```

## Health Checks

```bash
# Check SMS service health
curl https://gateway.mehrsun.gold/health

# Should return:
# {"status":"OK","service":"SMS Standalone Server","timestamp":"..."}
```

## Monitoring

```bash
# View logs
pm2 logs sms-standalone

# Monitor resources
pm2 monit

# Restart if needed
pm2 restart sms-standalone
```

## Troubleshooting

### CORS Issues
- Ensure `https://panel.mehrsun.gold` is in the CORS origin list in `sms-standalone-server.js`
- Check nginx proxy headers are forwarding correctly

### MongoDB Connection
- Verify `MONGO_URI` is accessible from production server
- Check firewall rules allow connection to MongoDB port

### SMS Not Sending
- Verify `KAVENEGAR_API_KEY` and `KAVENEGAR_SENDER` in .env.production
- Check Kavenegar panel for account balance and service status
- Review logs: `pm2 logs sms-standalone`

### Port Conflicts
- If port 3006 is in use, change `SMS_PORT` in .env and update nginx proxy
- Restart both SMS service and nginx after port change

## Security Notes

1. **JWT Token Validation**: Currently basic - enhance `authMiddleware` in production
2. **Rate Limiting**: Consider adding rate limits to prevent SMS abuse
3. **Env Security**: Never commit .env.production to git
4. **HTTPS Only**: Ensure all production traffic uses HTTPS
5. **Firewall**: Restrict port 3006 to localhost only (nginx proxies externally)

## Production Checklist

- [ ] MongoDB connection string updated in .env.production
- [ ] Kavenegar API key configured
- [ ] Frontend NEXT_PUBLIC_SMS_API_URL points to gateway
- [ ] Nginx proxy configured and tested
- [ ] PM2 started and saved
- [ ] Health endpoint responding
- [ ] Test SMS send from admin panel
- [ ] Logs directory exists and is writable
- [ ] SSL certificate valid for gateway domain
- [ ] CORS origins include production domain

## Rollback Plan

```bash
# Stop SMS service
pm2 stop sms-standalone

# Revert to previous version if needed
cd /path/to/mehrsungold-backend
git checkout <previous-commit>
pm2 restart sms-standalone
```

## Support
For issues, check:
1. PM2 logs: `pm2 logs sms-standalone`
2. Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
3. MongoDB connection logs
4. Kavenegar panel for SMS delivery status
