/**
 * SMS Log Schema - Track all sent SMS messages
 */

const mongoose = require('mongoose');

const SmsLogSchema = new mongoose.Schema({
    // Recipient info
    mobileNumber: {
        type: String,
        required: true,
        index: true
    },
    
    // SMS details
    type: {
        type: String,
        required: true,
        enum: ['registration', 'deposit', 'withdrawal', 'bulk', 'filtered'],
        index: true
    },
    
    message: {
        type: String,
        required: true
    },
    
    // Status
    status: {
        type: String,
        required: true,
        enum: ['sent', 'failed', 'pending'],
        default: 'pending',
        index: true
    },
    
    // Response from Kavenegar
    response: {
        type: Object,
        default: null
    },
    
    error: {
        type: String,
        default: null
    },
    
    // Metadata
    amount: {
        type: Number,
        default: null
    },
    
    recipientCount: {
        type: Number,
        default: 1
    },
    
    // Timestamps
    sentAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true,
    versionKey: false
});

// Indexes for better query performance
SmsLogSchema.index({ sentAt: -1 });
SmsLogSchema.index({ type: 1, sentAt: -1 });
SmsLogSchema.index({ status: 1, sentAt: -1 });
SmsLogSchema.index({ mobileNumber: 1, sentAt: -1 });

module.exports = mongoose.model('SmsLog', SmsLogSchema);
