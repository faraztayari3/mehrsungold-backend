const mongoose = require('mongoose');

const ScheduledSmsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  
  // زمان‌بندی
  scheduledTime: {
    type: Date,
    required: true
  },
  cronExpression: {
    type: String, // برای تکرار (اختیاری)
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  
  // فیلترهای کاربر
  filters: {
    // نوع کاربر
    userType: {
      type: String,
      enum: ['all', 'special', 'normal'],
      default: 'all'
    },
    
    // سطح کاربر (چند انتخابی)
    userLevels: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Level'
    }],
    
    // بازه موجودی (تومان)
    balanceRange: {
      min: { type: Number },
      max: { type: Number }
    },
    
    // بازه گردش مالی (تومان)
    transactionVolumeRange: {
      min: { type: Number },
      max: { type: Number }
    },
    
    // بازه زمان ثبت‌نام
    registrationDateRange: {
      from: { type: Date },
      to: { type: Date }
    },
    
    // وضعیت احراز هویت
    verificationStatus: {
      type: String,
      enum: ['all', 'verified', 'pending', 'rejected'],
      default: 'all'
    },
    
    // وضعیت حساب
    accountStatus: {
      type: String,
      enum: ['all', 'active', 'inactive', 'suspended'],
      default: 'all'
    },
    
    // میزان موجودی طلا (گرم)
    goldBalanceRange: {
      min: { type: Number },
      max: { type: Number }
    },
    
    // میزان موجودی نقره (گرم)
    silverBalanceRange: {
      min: { type: Number },
      max: { type: Number }
    }
  },
  
  // وضعیت اجرا
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  // نتایج اجرا
  execution: {
    lastRunAt: { type: Date },
    nextRunAt: { type: Date },
    totalRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    errorMessage: { type: String }
  },
  
  // ایجادکننده
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index برای بهبود عملکرد
ScheduledSmsSchema.index({ scheduledTime: 1, status: 1 });
ScheduledSmsSchema.index({ createdBy: 1 });
ScheduledSmsSchema.index({ 'execution.nextRunAt': 1 });

module.exports = mongoose.model('ScheduledSms', ScheduledSmsSchema);
