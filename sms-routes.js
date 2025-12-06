// SMS Routes Handler - Add SMS endpoints to main backend
const { SmsService } = require('./sms/sms.service');
const mongoose = require('mongoose');

// Define Schema
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

function setupSmsRoutes(app) {
    // GET /dashboard/weekly-metals
    app.get('/dashboard/weekly-metals', async (req, res) => {
        try {
            const Transaction = mongoose.model('Transaction');
            const Tradeable = mongoose.model('Tradeable');
            
            // Get gold and silver IDs
            const gold = await Tradeable.findOne({ name: 'gold' });
            const silver = await Tradeable.findOne({ name: 'silver' });
            
            if (!gold || !silver) {
                return res.status(404).json({ message: 'Tradeables not found' });
            }
            
            const goldId = gold._id;
            const silverId = silver._id;
            
            // Get date from one week ago
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            
            // Aggregate gold transactions
            const goldResult = await Transaction.aggregate([
                {
                    $match: {
                        status: 'Successful',
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
            
            // Aggregate silver transactions
            const silverResult = await Transaction.aggregate([
                {
                    $match: {
                        status: 'Successful',
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

    // GET /settings/sms
    app.get('/settings/sms', async (req, res) => {
        try {
            // Simple auth check - you can enhance this
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ message: 'Unauthorized', statusCode: 401 });
            }

            const settings = await smsService.getSettings();
            res.json(settings);
        } catch (error) {
            res.status(500).json({ message: error.message, statusCode: 500 });
        }
    });

    // PUT /settings/sms
    app.put('/settings/sms', async (req, res) => {
        try {
            // Simple auth check
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ message: 'Unauthorized', statusCode: 401 });
            }

            const result = await smsService.updateSettings(req.body);
            res.json({ 
                statusCode: 200, 
                message: 'تنظیمات با موفقیت ذخیره شد', 
                data: result 
            });
        } catch (error) {
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
}

module.exports = { setupSmsRoutes };
