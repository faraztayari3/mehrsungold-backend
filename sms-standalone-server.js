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
const ScheduledSmsController = require('./sms/scheduled-sms.controller');
const SmsScheduler = require('./sms/sms-scheduler');

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mehrsungold';

console.log('🔍 Attempting MongoDB connection to:', MONGO_URI);

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ MongoDB connected for SMS service'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  SMS service will continue without database (settings won\'t persist)');
});

// Define SMS Settings Schema
const SMSTemplateSchema = new mongoose.Schema({
    enabled: { type: Boolean, required: true, default: false },
    message: { 
        type: String, 
        default: '' 
    },
    templateName: { 
        type: String, 
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

// Define SMS Log Schema
const SmsLogSchema = new mongoose.Schema({
    mobileNumber: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['registration', 'deposit', 'withdrawal', 'bulk', 'filtered'], index: true },
    message: { type: String, required: true },
    status: { type: String, required: true, enum: ['sent', 'failed', 'pending'], default: 'pending', index: true },
    response: { type: Object, default: null },
    error: { type: String, default: null },
    amount: { type: Number, default: null },
    recipientCount: { type: Number, default: 1 },
    sentAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true, versionKey: false });

const SmsLogModel = mongoose.models.SmsLog || mongoose.model('SmsLog', SmsLogSchema);

const smsService = new SmsService(SmsSettingsModel, SmsLogModel);

// Create Express App
const app = express();
const PORT = process.env.SMS_PORT || 3005;

// Middleware - CORS configured for production
app.use(cors({
    origin: [
        'https://panel.mehrsun.gold',
        'http://panel.mehrsun.gold',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3005',
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
        const { recipients, templateType, message } = req.body;
        
        if (!recipients || !Array.isArray(recipients)) {
            return res.status(400).json({ 
                statusCode: 400,
                message: 'لیست گیرندگان الزامی است' 
            });
        }

        console.log('[SMS] Sending bulk SMS to', recipients.length, 'recipients, type:', templateType);
        
        // Get settings to determine message content
        const settings = await SmsSettingsModel.findOne();
        let messageText = message;
        
        // If no explicit message provided, use settings based on templateType
        if (!messageText && settings) {
            if (templateType === 'unverified' && settings.unverifiedUsers) {
                messageText = settings.unverifiedUsers.message || 'پیام پیش‌فرض برای کاربران احراز نشده';
            } else if (templateType === 'verified' && settings.verifiedUsers) {
                messageText = settings.verifiedUsers.message || 'پیام پیش‌فرض برای کاربران احراز شده';
            }
        }
        
        if (!messageText) {
            return res.status(400).json({ 
                statusCode: 400,
                message: 'متن پیام یافت نشد. لطفا در تنظیمات پیام را وارد کنید' 
            });
        }
        
        // Send SMS to all recipients using plain SMS
        const results = await Promise.allSettled(
            recipients.map(recipient => 
                smsService.sendPlainSMS(recipient, messageText, null, 'bulk', {
                    recipientCount: recipients.length
                })
            )
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

// GET /sms/logs - Get SMS logs with filtering and sorting
app.get('/sms/logs', authMiddleware, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            type, 
            status, 
            mobileNumber,
            startDate,
            endDate,
            sortBy = 'sentAt',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = {};
        
        if (type) query.type = type;
        if (status) query.status = status;
        if (mobileNumber) query.mobileNumber = { $regex: mobileNumber, $options: 'i' };
        
        if (startDate || endDate) {
            query.sentAt = {};
            if (startDate) query.sentAt.$gte = new Date(startDate);
            if (endDate) query.sentAt.$lte = new Date(endDate);
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        // Execute query
        const [logs, total] = await Promise.all([
            SmsLogModel.find(query)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            SmsLogModel.countDocuments(query)
        ]);

        // Get statistics
        const stats = await SmsLogModel.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statistics = {
            total,
            sent: stats.find(s => s._id === 'sent')?.count || 0,
            failed: stats.find(s => s._id === 'failed')?.count || 0,
            pending: stats.find(s => s._id === 'pending')?.count || 0
        };

        res.json({
            statusCode: 200,
            data: {
                logs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                },
                statistics
            }
        });
    } catch (error) {
        console.error('[SMS] Error fetching logs:', error);
        res.status(500).json({
            statusCode: 500,
            message: 'خطا در دریافت گزارش پیامک‌ها: ' + error.message
        });
    }
});

// ==================== Scheduled SMS Routes ====================
const scheduledSmsController = new ScheduledSmsController();

// Create scheduled SMS
app.post('/sms/scheduled', async (req, res) => {
    await scheduledSmsController.create(req, res);
});

// Get all scheduled SMS
app.get('/sms/scheduled', async (req, res) => {
    await scheduledSmsController.getAll(req, res);
});

// Get one scheduled SMS
app.get('/sms/scheduled/:id', async (req, res) => {
    await scheduledSmsController.getOne(req, res);
});

// Update scheduled SMS
app.put('/sms/scheduled/:id', async (req, res) => {
    await scheduledSmsController.update(req, res);
});

// Delete scheduled SMS
app.delete('/sms/scheduled/:id', async (req, res) => {
    await scheduledSmsController.delete(req, res);
});

// Toggle active status
app.patch('/sms/scheduled/:id/toggle', async (req, res) => {
    await scheduledSmsController.toggleActive(req, res);
});

// Execute now (manual trigger)
app.post('/sms/scheduled/:id/execute', async (req, res) => {
    await scheduledSmsController.executeNow(req, res);
});

// Get statistics
app.get('/sms/scheduled/stats/summary', async (req, res) => {
    await scheduledSmsController.getStatistics(req, res);
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n🚀 SMS Standalone Server running on port ${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
    console.log(`⚙️  SMS Settings: http://localhost:${PORT}/settings/sms`);
    console.log(`📤 Send endpoints available at /sms/send/*\n`);
    
    // شروع Scheduler برای پیامک‌های زمان‌بندی شده
    const smsScheduler = new SmsScheduler();
    smsScheduler.start();
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
