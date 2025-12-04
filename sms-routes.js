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

const SmsSettingsModel = mongoose.model('smssettings', SMSSettingsSchema);
const smsService = new SmsService(SmsSettingsModel);

function setupSmsRoutes(app) {
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
