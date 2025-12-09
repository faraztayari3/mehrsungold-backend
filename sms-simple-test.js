/**
 * Simple SMS Test Server - NO DATABASE REQUIRED
 * Use this to test Kavenegar integration without MongoDB
 */

const express = require('express');
const cors = require('cors');
const Kavenegar = require('kavenegar');

const app = express();
const PORT = process.env.SMS_PORT || 3005;

// Kavenegar API
const api = Kavenegar.KavenegarApi({
    apikey: '4B37447A59365645492B5A52646F674E785474384F6D75373872396C6E5A334C5A31367650576A306E73673D'
});
const sender = '10018018949161';

// Middleware
app.use(cors());
app.use(express.json());

// In-memory settings (will reset on restart)
let smsSettings = {
    registration: {
        enabled: true,
        templateName: 'gold-register',
        tokens: {
            token: 'کاربر',
            token2: 'گرامی'
        }
    },
    deposit: {
        enabled: true,
        templateName: 'gold-deposit',
        tokens: {}
    },
    withdrawal: {
        enabled: true,
        templateName: 'gold-withdrawal',
        tokens: {}
    }
};

// Helper function to send SMS
const sendSMS = (receptor, templateName, tokens = {}) => {
    return new Promise((resolve, reject) => {
        const params = {
            receptor: receptor,
            template: templateName,
            ...tokens
        };

        console.log('📤 Sending SMS:', { receptor, templateName, tokens });

        api.VerifyLookup(params, (response, status) => {
            if (status === 200) {
                console.log('✅ SMS sent successfully to', receptor);
                resolve(response);
            } else {
                console.error('❌ Failed to send SMS:', status);
                reject(new Error(`SMS send failed with status: ${status}`));
            }
        });
    });
};

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'SMS Simple Test Server (No Database)',
        timestamp: new Date().toISOString(),
        kavenegar: 'Connected'
    });
});

// GET settings
app.get('/settings/sms', (req, res) => {
    res.json({
        statusCode: 200,
        data: smsSettings
    });
});

// UPDATE settings
app.put('/settings/sms', (req, res) => {
    smsSettings = { ...smsSettings, ...req.body };
    res.json({ 
        statusCode: 200, 
        message: 'تنظیمات با موفقیت ذخیره شد (in-memory)',
        data: smsSettings
    });
});

// Send registration SMS
app.post('/sms/send/registration', async (req, res) => {
    try {
        const { mobileNumber } = req.body;
        
        if (!mobileNumber) {
            return res.status(400).json({ 
                statusCode: 400,
                message: 'شماره موبایل الزامی است' 
            });
        }

        if (!smsSettings.registration.enabled) {
            return res.json({ 
                statusCode: 200,
                message: 'ارسال پیامک ثبت نام غیرفعال است' 
            });
        }

        console.log('📱 Registration SMS request for:', mobileNumber);
        
        await sendSMS(
            mobileNumber, 
            smsSettings.registration.templateName, 
            smsSettings.registration.tokens
        );
        
        res.json({ 
            statusCode: 200,
            message: 'پیامک ثبت نام با موفقیت ارسال شد' 
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            statusCode: 500,
            message: 'خطا در ارسال پیامک: ' + error.message 
        });
    }
});

// Send deposit SMS
app.post('/sms/send/deposit', async (req, res) => {
    try {
        const { mobileNumber, amount } = req.body;
        
        if (!mobileNumber) {
            return res.status(400).json({ 
                statusCode: 400,
                message: 'شماره موبایل الزامی است' 
            });
        }

        if (!smsSettings.deposit.enabled) {
            return res.json({ 
                statusCode: 200,
                message: 'ارسال پیامک واریز غیرفعال است' 
            });
        }

        console.log('📱 Deposit SMS request for:', mobileNumber, 'Amount:', amount);
        
        await sendSMS(
            mobileNumber, 
            smsSettings.deposit.templateName, 
            smsSettings.deposit.tokens
        );
        
        res.json({ 
            statusCode: 200,
            message: 'پیامک واریز با موفقیت ارسال شد' 
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            statusCode: 500,
            message: 'خطا در ارسال پیامک: ' + error.message 
        });
    }
});

// Send withdrawal SMS
app.post('/sms/send/withdrawal', async (req, res) => {
    try {
        const { mobileNumber, amount } = req.body;
        
        if (!mobileNumber) {
            return res.status(400).json({ 
                statusCode: 400,
                message: 'شماره موبایل الزامی است' 
            });
        }

        if (!smsSettings.withdrawal.enabled) {
            return res.json({ 
                statusCode: 200,
                message: 'ارسال پیامک برداشت غیرفعال است' 
            });
        }

        console.log('📱 Withdrawal SMS request for:', mobileNumber, 'Amount:', amount);
        
        await sendSMS(
            mobileNumber, 
            smsSettings.withdrawal.templateName, 
            smsSettings.withdrawal.tokens
        );
        
        res.json({ 
            statusCode: 200,
            message: 'پیامک برداشت با موفقیت ارسال شد' 
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            statusCode: 500,
            message: 'خطا در ارسال پیامک: ' + error.message 
        });
    }
});

// Test SMS endpoint
app.post('/sms/test', async (req, res) => {
    try {
        const { mobileNumber, template, tokens } = req.body;
        
        if (!mobileNumber || !template) {
            return res.status(400).json({ 
                statusCode: 400,
                message: 'شماره موبایل و template الزامی است' 
            });
        }

        console.log('🧪 Test SMS request:', { mobileNumber, template, tokens });
        
        await sendSMS(mobileNumber, template, tokens || {});
        
        res.json({ 
            statusCode: 200,
            message: 'پیامک تست با موفقیت ارسال شد' 
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            statusCode: 500,
            message: 'خطا در ارسال پیامک: ' + error.message 
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n🚀 SMS Simple Test Server running on port ${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 Test endpoint: POST /sms/test`);
    console.log(`⚠️  Note: This is a simple test server without database`);
    console.log(`⚠️  Settings are stored in memory and will be lost on restart\n`);
});
