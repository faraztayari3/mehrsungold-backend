'use strict';

var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};

const { Injectable, Logger } = require('@nestjs/common');
const { InjectModel } = require('@nestjs/mongoose');
const Kavenegar = require('kavenegar');

let SmsService = class SmsService {
    constructor(smsSettingsModel) {
        this.smsSettingsModel = smsSettingsModel;
        this.logger = new Logger(SmsService.name);
        this.api = Kavenegar.KavenegarApi({
            apikey: '4B37447A59365645492B5A52646F674E785474384F6D75373872396C6E5A334C5A31367650576A306E73673D'
        });
        this.sender = '10018018949161';
        this.templateCode = 'gold-register'; // Template name for lookup
    }

    /**
     * Get SMS settings
     */
    async getSettings() {
        let settings = await this.smsSettingsModel.findOne().exec();
        
        if (!settings) {
            // Create default settings if not exists
            settings = await this.smsSettingsModel.create({
                registration: {
                    enabled: false,
                    templateName: 'gold-register',
                    tokens: {}
                },
                deposit: {
                    enabled: false,
                    templateName: 'gold-deposit',
                    tokens: {}
                },
                withdrawal: {
                    enabled: false,
                    templateName: 'gold-withdrawal',
                    tokens: {}
                },
                verifiedUsers: {
                    enabled: false,
                    templateName: 'gold-verified',
                    tokens: {}
                },
                unverifiedUsers: {
                    enabled: false,
                    templateName: 'gold-unverified',
                    tokens: {}
                }
            });
        }

        return settings;
    }

    /**
     * Update SMS settings
     */
    async updateSettings(dto) {
        const settings = await this.smsSettingsModel.findOne().exec();
        
        if (settings) {
            Object.assign(settings, dto);
            await settings.save();
        } else {
            await this.smsSettingsModel.create(dto);
        }

        return { message: 'تنظیمات پیامک با موفقیت ذخیره شد' };
    }



    /**
     * Send SMS via Kavenegar using Lookup (Template)
     */
    async sendSMS(receptor, templateName, tokens) {
        try {
            return new Promise((resolve, reject) => {
                const params = {
                    receptor: receptor,
                    template: templateName,
                    ...tokens
                };

                this.api.VerifyLookup(params, (response, status) => {
                    if (status === 200) {
                        this.logger.log(`SMS sent successfully to ${receptor}`);
                        resolve(response);
                    } else {
                        this.logger.error(`Failed to send SMS: ${status}`);
                        reject(new Error(`SMS send failed with status: ${status}`));
                    }
                });
            });
        } catch (error) {
            this.logger.error(`Error sending SMS: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send registration SMS
     */
    async sendRegistrationSMS(user) {
        try {
            const settings = await this.getSettings();
            
            if (!settings.registration.enabled) {
                return;
            }

            // Use tokens from settings
            await this.sendSMS(user.mobileNumber, settings.registration.templateName, settings.registration.tokens);
        } catch (error) {
            this.logger.error(`Error sending registration SMS: ${error.message}`);
        }
    }

    /**
     * Send deposit SMS
     */
    async sendDepositSMS(user, transaction) {
        try {
            const settings = await this.getSettings();
            
            if (!settings.deposit.enabled) {
                return;
            }

            // Use tokens from settings
            await this.sendSMS(user.mobileNumber, settings.deposit.templateName, settings.deposit.tokens);
        } catch (error) {
            this.logger.error(`Error sending deposit SMS: ${error.message}`);
        }
    }

    /**
     * Send withdrawal SMS
     */
    async sendWithdrawalSMS(user, transaction) {
        try {
            const settings = await this.getSettings();
            
            if (!settings.withdrawal.enabled) {
                return;
            }

            // Use tokens from settings
            await this.sendSMS(user.mobileNumber, settings.withdrawal.templateName, settings.withdrawal.tokens);
        } catch (error) {
            this.logger.error(`Error sending withdrawal SMS: ${error.message}`);
        }
    }

    /**
     * Send bulk SMS to verified users
     */
    async sendToVerifiedUsers(userModel) {
        try {
            const settings = await this.getSettings();
            
            if (!settings.verifiedUsers.enabled || !settings.verifiedUsers.templateName) {
                throw new Error('SMS for verified users is not enabled or template name is empty');
            }

            const users = await userModel.find({ verificationStatus: 'Verified' }).exec();

            for (const user of users) {
                // Use tokens from settings
                await this.sendSMS(user.mobileNumber, settings.verifiedUsers.templateName, settings.verifiedUsers.tokens);
            }

            return { message: `پیامک برای ${users.length} کاربر احراز شده ارسال شد` };
        } catch (error) {
            this.logger.error(`Error sending bulk SMS to verified users: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send bulk SMS to unverified users
     */
    async sendToUnverifiedUsers(userModel) {
        try {
            const settings = await this.getSettings();
            
            if (!settings.unverifiedUsers.enabled || !settings.unverifiedUsers.templateName) {
                throw new Error('SMS for unverified users is not enabled or template name is empty');
            }

            const users = await userModel.find({ verificationStatus: { $ne: 'Verified' } }).exec();

            for (const user of users) {
                // Use tokens from settings
                await this.sendSMS(user.mobileNumber, settings.unverifiedUsers.templateName, settings.unverifiedUsers.tokens);
            }

            return { message: `پیامک برای ${users.length} کاربر احراز نشده ارسال شد` };
        } catch (error) {
            this.logger.error(`Error sending bulk SMS to unverified users: ${error.message}`);
            throw error;
        }
    }
};

SmsService = __decorate([
    Injectable(),
    __param(0, InjectModel('SMSSettings')),
    __metadata("design:paramtypes", [Object])
], SmsService);

module.exports = { SmsService };
