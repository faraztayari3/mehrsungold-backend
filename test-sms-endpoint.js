// Temporary test endpoint for SMS
const express = require('express');
const { SmsService } = require('./sms/sms.service');
const mongoose = require('mongoose');

const app = express();

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

// Add CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Connect to MongoDB
mongoose.connect('mongodb://root:hg8XuxScCylaVcnI@services.irn2.chabokan.net:13749/gold?authSource=admin');

// Define Schema manually
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

const SmsSettingsModel = mongoose.model('smssettings', SMSSettingsSchema);
const smsService = new SmsService(SmsSettingsModel);

// Transaction Model
const TransactionModel = mongoose.model('transactions', new mongoose.Schema({}, { strict: false }));
const TradeableModel = mongoose.model('tradeables', new mongoose.Schema({}, { strict: false }));

// User Model for testing
const UserModel = mongoose.model('users', new mongoose.Schema({}, { strict: false }));

// GET endpoint for weekly traded metals (gold and silver)
app.get('/dashboard/weekly-metals', async (req, res) => {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        // Get gold and silver tradeables
        const tradeables = await TradeableModel.find({
            name: { $in: ['GOLD', 'SILVER'] }
        }).lean();
        
        const goldId = tradeables.find(t => t.name === 'GOLD')?._id;
        const silverId = tradeables.find(t => t.name === 'SILVER')?._id;
        
        // Aggregate for gold
        const goldResult = await TransactionModel.aggregate([
            {
                $match: {
                    status: 'Accepted',
                    createdAt: { $gte: oneWeekAgo },
                    tradeable: goldId
                }
            },
            {
                $group: {
                    _id: '$type',
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);
        
        // Aggregate for silver
        const silverResult = await TransactionModel.aggregate([
            {
                $match: {
                    status: 'Accepted',
                    createdAt: { $gte: oneWeekAgo },
                    tradeable: silverId
                }
            },
            {
                $group: {
                    _id: '$type',
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);
        
        // Process gold results
        const goldBuy = goldResult.find(r => r._id === 'Buy')?.totalAmount || 0;
        const goldSell = goldResult.find(r => r._id === 'Sell')?.totalAmount || 0;
        const goldTotal = goldBuy + goldSell;
        
        // Process silver results
        const silverBuy = silverResult.find(r => r._id === 'Buy')?.totalAmount || 0;
        const silverSell = silverResult.find(r => r._id === 'Sell')?.totalAmount || 0;
        const silverTotal = silverBuy + silverSell;
        
        res.json({
            gold: {
                buy: {
                    grams: goldBuy.toFixed(3),
                    milligrams: (goldBuy * 1000).toFixed(0)
                },
                sell: {
                    grams: goldSell.toFixed(3),
                    milligrams: (goldSell * 1000).toFixed(0)
                },
                total: {
                    grams: goldTotal.toFixed(3),
                    milligrams: (goldTotal * 1000).toFixed(0)
                }
            },
            silver: {
                buy: {
                    grams: silverBuy.toFixed(3),
                    milligrams: (silverBuy * 1000).toFixed(0)
                },
                sell: {
                    grams: silverSell.toFixed(3),
                    milligrams: (silverSell * 1000).toFixed(0)
                },
                total: {
                    grams: silverTotal.toFixed(3),
                    milligrams: (silverTotal * 1000).toFixed(0)
                }
            },
            startDate: oneWeekAgo,
            endDate: new Date()
        });
    } catch (error) {
        console.error('Error getting weekly metals:', error);
        res.status(500).json({ message: error.message });
    }
});

// GET endpoint
app.get('/settings/sms', async (req, res) => {
    try {
        const settings = await smsService.getSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PUT endpoint
app.put('/settings/sms', async (req, res) => {
    try {
        console.log('Received data:', JSON.stringify(req.body, null, 2));
        const result = await smsService.updateSettings(req.body);
        res.json({ 
            statusCode: 200, 
            message: 'تنظیمات با موفقیت ذخیره شد', 
            data: result 
        });
    } catch (error) {
        console.error('Error:', error);
        
        // Handle Mongoose validation errors with detailed messages
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

// Test endpoint for sending registration SMS
app.post('/test/sms/registration', async (req, res) => {
    try {
        const { mobileNumber, userId } = req.body;
        
        if (!mobileNumber && !userId) {
            return res.status(400).json({ 
                success: false,
                message: 'شماره موبایل یا شناسه کاربر الزامی است' 
            });
        }

        let user;
        if (userId) {
            user = await UserModel.findById(userId).lean();
            if (!user) {
                return res.status(404).json({ 
                    success: false,
                    message: 'کاربر یافت نشد' 
                });
            }
        } else {
            user = { mobileNumber };
        }

        const settings = await smsService.getSettings();
        
        if (!settings.registration.enabled) {
            return res.status(400).json({ 
                success: false,
                message: 'ارسال پیامک ثبت نام غیرفعال است. لطفا ابتدا آن را فعال کنید.' 
            });
        }

        if (!settings.registration.templateName) {
            return res.status(400).json({ 
                success: false,
                message: 'نام الگوی پیامک ثبت نام تنظیم نشده است' 
            });
        }

        await smsService.sendRegistrationSMS(user);
        
        res.json({ 
            success: true,
            message: `پیامک خوش‌آمدگویی با موفقیت به شماره ${user.mobileNumber} ارسال شد`,
            data: {
                receptor: user.mobileNumber,
                template: settings.registration.templateName,
                tokens: settings.registration.tokens
            }
        });
    } catch (error) {
        console.error('Error sending test SMS:', error);
        res.status(500).json({ 
            success: false,
            message: 'خطا در ارسال پیامک: ' + error.message 
        });
    }
});

app.listen(3004, () => {
    console.log('SMS test endpoint running on http://localhost:3004');
});
