/**
 * SMS Hooks - Automatic SMS sending after specific events
 * This file intercepts authentication routes and sends SMS automatically
 */

const express = require('express');
const { SmsService } = require('./sms/sms.service');
const mongoose = require('mongoose');

// SMS Settings Schema
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

/**
 * Middleware to intercept registration responses and send welcome SMS
 */
function registrationSmsHook(req, res, next) {
    // Store original send function
    const originalJson = res.json.bind(res);
    
    // Override json method
    res.json = async function(data) {
        try {
            // Check if this is a successful registration response
            if (req.method === 'POST' && 
                req.path === '/auth/register' && 
                res.statusCode === 201 &&
                data) {
                
                // Extract mobile number from request body
                const mobileNumber = req.body?.mobileNumber;
                
                if (mobileNumber) {
                    console.log('[SMS Hook] Registration detected for:', mobileNumber);
                    
                    // Send registration SMS asynchronously (don't wait)
                    smsService.sendRegistrationSMS({ mobileNumber })
                        .then(() => {
                            console.log('[SMS Hook] Welcome SMS sent to:', mobileNumber);
                        })
                        .catch(err => {
                            console.error('[SMS Hook] Failed to send welcome SMS:', err.message);
                        });
                }
            }
        } catch (error) {
            console.error('[SMS Hook] Error in registration hook:', error.message);
        }
        
        // Call original json method
        return originalJson(data);
    };
    
    next();
}

/**
 * Setup SMS hooks middleware
 */
function setupSmsHooks(app) {
    console.log('[SMS Hooks] Initializing automatic SMS hooks...');
    
    // Apply registration hook middleware
    app.use(registrationSmsHook);
    
    console.log('[SMS Hooks] Registration SMS hook activated');
}

module.exports = {
    setupSmsHooks,
    smsService
};
