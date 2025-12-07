/**
 * SMS Standalone Server
 * Run this on a different port (e.g., 3005) to handle SMS operations
 * This bypasses the obfuscated main.js issue
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const { SmsService } = require('./sms/sms.service');

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mehrsungold';

console.log('🔍 Attempting MongoDB connection to:', MONGO_URI);

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
})
.then(() => console.log('✅ MongoDB connected for SMS service'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  SMS service will continue without database (settings won\'t persist)');
});

// Define SMS Settings Schema
const SMSTemplateSchema = new mongoose.Schema({
    enabled: { type: Boolean, required: true, default: false },
    templateName: { 
        type: String, 
        required: function() { return this.enabled; },
        default: '' 
    },
    tokens: { type: Object, default: {} }
}, { versionKey: false, _id: false });

const SMSSettingsSchema = new mongoose.Schema({
    registration: { type: SMSTemplateSchema, required: true },
    deposit: { type: SMSTemplateSchema, required: true },
    withdrawal: { type: SMSTemplateSchema, required: true },
    verifiedUsers: { type: SMSTemplateSchema, required: true },
    unverifiedUsers: { type: SMSTemplateSchema, required: true }
}, { versionKey: false });

// Check if model already exists to avoid OverwriteModelError
const SmsSettingsModel = mongoose.models.smssettings || mongoose.model('smssettings', SMSSettingsSchema);
const smsService = new SmsService(SmsSettingsModel);

// Create Express App
const app = express();
const PORT = process.env.SMS_PORT || 3005;

// Middleware - CORS configured for production
app.use(cors({
    origin: [
        'https://panel.mehrsun.gold',
        'http://panel.mehrsun.gold',
        'http://localhost:3000',
        'http://172.17.0.33',
        'http://172.17.0.68'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Simple auth middleware (you can enhance this)
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            statusCode: 401,
            message: 'Unauthorized - No token provided' 
        });
    }
    
    // For now, just check if token exists
    // You can add JWT verification here if needed
    next();
};

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'SMS Standalone Server',
        timestamp: new Date().toISOString() 
    });
});

// GET /settings/sms - Get SMS settings
app.get('/settings/sms', authMiddleware, async (req, res) => {
    try {
        const settings = await smsService.getSettings();
        res.json({
            statusCode: 200,
            data: settings
        });
    } catch (error) {
        console.error('Error fetching SMS settings:', error);
        res.status(500).json({ 
            statusCode: 500,
            message: error.message 
        });
    }
});

// PUT /settings/sms - Update SMS settings
app.put('/settings/sms', authMiddleware, async (req, res) => {
    try {
        const result = await smsService.updateSettings(req.body);
        res.json({ 
            statusCode: 200, 
            message: 'تنظیمات با موفقیت ذخیره شد', 
            data: result 
        });
    } catch (error) {
        console.error('Error updating SMS settings:', error);
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.keys(error.errors).map(key => {
                const fieldName = key.split('.')[0];
                const friendlyNames = {
                    registration: 'ثبت نام',
                    deposit: 'واریز',
                    withdrawal: 'برداشت',
                    verifiedUsers: 'کاربران تایید شده',
                    unverifiedUsers: 'کاربران تایید نشده'
                };
                return `${friendlyNames[fieldName] || fieldName}: نام الگو اجباری است`;
            });
            
            return res.status(400).json({ 
                statusCode: 400,
                message: errors.join(', ')
            });
        }
        
        res.status(500).json({ 
            statusCode: 500,
            message: 'خطا در ذخیره تنظیمات: ' + error.message 
        });
    }
});

// POST /sms/send/registration - Send registration SMS
app.post('/sms/send/registration', async (req, res) => {
    try {
        const { mobileNumber } = req.body;
        
        if (!mobileNumber) {
            return res.status(400).json({ 
                statusCode: 400,
                message: 'شماره موبایل الزامی است' 
            });
        }

        console.log('[SMS] Sending registration SMS to:', mobileNumber);
        await smsService.sendRegistrationSMS({ mobileNumber });
        
        res.json({ 
            statusCode: 200,
            message: 'پیامک ثبت نام با موفقیت ارسال شد' 
        });
    } catch (error) {
        console.error('[SMS] Error sending registration SMS:', error);
        res.status(500).json({ 
            statusCode: 500,
            message: 'خطا در ارسال پیامک: ' + error.message 
        });
    }
});

// POST /sms/send/deposit - Send deposit SMS
app.post('/sms/send/deposit', async (req, res) => {
    try {
        const { mobileNumber, amount } = req.body;
        
        if (!mobileNumber) {
            return res.status(400).json({ 
                statusCode: 400,
                message: 'شماره موبایل الزامی است' 
            });
        }

        console.log('[SMS] Sending deposit SMS to:', mobileNumber, 'Amount:', amount);
        await smsService.sendDepositSMS(
            { mobileNumber }, 
            { amount: amount || 0 }
        );
        
        res.json({ 
            statusCode: 200,
            message: 'پیامک واریز با موفقیت ارسال شد' 
        });
    } catch (error) {
        console.error('[SMS] Error sending deposit SMS:', error);
        res.status(500).json({ 
            statusCode: 500,
            message: 'خطا در ارسال پیامک: ' + error.message 
        });
    }
});

// POST /sms/send/withdrawal - Send withdrawal SMS
app.post('/sms/send/withdrawal', async (req, res) => {
    try {
        const { mobileNumber, amount } = req.body;
        
        if (!mobileNumber) {
            return res.status(400).json({ 
                statusCode: 400,
                message: 'شماره موبایل الزامی است' 
            });
        }

        console.log('[SMS] Sending withdrawal SMS to:', mobileNumber, 'Amount:', amount);
        await smsService.sendWithdrawalSMS(
            { mobileNumber }, 
            { amount: amount || 0 }
        );
        
        res.json({ 
            statusCode: 200,
            message: 'پیامک برداشت با موفقیت ارسال شد' 
        });
    } catch (error) {
        console.error('[SMS] Error sending withdrawal SMS:', error);
        res.status(500).json({ 
            statusCode: 500,
            message: 'خطا در ارسال پیامک: ' + error.message 
        });
    }
});

// POST /sms/send/bulk - Send bulk SMS (for future use)
app.post('/sms/send/bulk', authMiddleware, async (req, res) => {
    try {
        const { recipients, templateType } = req.body;
        
        if (!recipients || !Array.isArray(recipients)) {
            return res.status(400).json({ 
                statusCode: 400,
                message: 'لیست گیرندگان الزامی است' 
            });
        }

        console.log('[SMS] Sending bulk SMS to', recipients.length, 'recipients');
        
        // Send SMS to all recipients
        const results = await Promise.allSettled(
            recipients.map(recipient => {
                if (templateType === 'verified') {
                    return smsService.sendVerifiedUsersSMS({ mobileNumber: recipient });
                } else {
                    return smsService.sendUnverifiedUsersSMS({ mobileNumber: recipient });
                }
            })
        );
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        res.json({ 
            statusCode: 200,
            message: `ارسال انجام شد - موفق: ${successful}, ناموفق: ${failed}`,
            details: { successful, failed, total: recipients.length }
        });
    } catch (error) {
        console.error('[SMS] Error sending bulk SMS:', error);
        res.status(500).json({ 
            statusCode: 500,
            message: 'خطا در ارسال پیامک گروهی: ' + error.message 
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n🚀 SMS Standalone Server running on port ${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
    console.log(`⚙️  SMS Settings: http://localhost:${PORT}/settings/sms`);
    console.log(`📤 Send endpoints available at /sms/send/*\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing server...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing server...');
    await mongoose.connection.close();
    process.exit(0);
});
