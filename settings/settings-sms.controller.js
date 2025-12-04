const { Controller, Get, Put, Body, UseGuards } = require('@nestjs/common');
const { ApiBearerAuth, ApiTags } = require('@nestjs/swagger');
const { SmsService } = require('../sms/sms.service');
const { AdminGuard } = require('../auth/guard/admin.guard');
const mongoose = require('mongoose');

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

@Controller('settings')
@ApiTags('Settings')
@ApiBearerAuth()
class SettingsSmsController {
    constructor() {
        this.smsService = new SmsService(SmsSettingsModel);
    }

    @Get('sms')
    @UseGuards(AdminGuard)
    async getSmsSettings() {
        try {
            const settings = await this.smsService.getSettings();
            return settings;
        } catch (error) {
            throw error;
        }
    }

    @Put('sms')
    @UseGuards(AdminGuard)
    async updateSmsSettings(@Body() body) {
        try {
            const result = await this.smsService.updateSettings(body);
            return { 
                statusCode: 200, 
                message: 'تنظیمات با موفقیت ذخیره شد', 
                data: result 
            };
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
                
                throw new Error(errors.join(', '));
            }
            
            throw error;
        }
    }
}

module.exports = { SettingsSmsController };
