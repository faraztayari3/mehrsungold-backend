const ScheduledSms = require('./schema/scheduled-sms.schema');
const User = require('../user/schema/user.schema');
const { SmsService } = require('./sms.service');
const parser = require('cron-parser');

// Shared SMS settings/log models for non-Nest usage
let smsServiceSingleton = null;

function getSmsServiceInstance() {
  if (smsServiceSingleton) return smsServiceSingleton;

  const mongoose = require('mongoose');

  // Reuse existing models if defined (as set up in sms-standalone-server)
  const smsSettingsModel = mongoose.models.smssettings;
  const smsLogModel = mongoose.models.SmsLog;

  if (!smsSettingsModel) {
    throw new Error('SMS settings model not initialized');
  }

  smsServiceSingleton = new SmsService(smsSettingsModel, smsLogModel || null);
  return smsServiceSingleton;
}

class ScheduledSmsService {
  constructor(options = {}) {
    // Allow the host server to inject an SmsService; otherwise lazily build from mongoose models
    this.smsService = options.smsService || null;
  }

  async create(data, userId) {
    const scheduledSms = new ScheduledSms({
      ...data,
      createdBy: userId,
      status: 'pending'
    });

    // محاسبه nextRunAt
    if (data.isRecurring && data.cronExpression) {
      const interval = parser.parseExpression(data.cronExpression);
      scheduledSms.execution.nextRunAt = interval.next().toDate();
    } else {
      scheduledSms.execution.nextRunAt = data.scheduledTime;
    }

    await scheduledSms.save();
    return scheduledSms;
  }

  async getAll({ page = 1, limit = 20, status, isActive }) {
    const query = {};
    
    if (status) query.status = status;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ScheduledSms.find(query)
        .populate('createdBy', 'username email')
        .populate('filters.userLevels', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ScheduledSms.countDocuments(query)
    ]);

    return {
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getOne(id) {
    return ScheduledSms.findById(id)
      .populate('createdBy', 'username email')
      .populate('filters.userLevels', 'name');
  }

  async update(id, data) {
    const scheduledSms = await ScheduledSms.findById(id);
    if (!scheduledSms) return null;

    // اگر زمان یا cron تغییر کرد، nextRunAt را دوباره محاسبه کن
    if (data.scheduledTime || data.cronExpression) {
      if (data.isRecurring && data.cronExpression) {
        const interval = parser.parseExpression(data.cronExpression);
        scheduledSms.execution.nextRunAt = interval.next().toDate();
      } else {
        scheduledSms.execution.nextRunAt = data.scheduledTime || scheduledSms.scheduledTime;
      }
    }

    Object.assign(scheduledSms, data);
    await scheduledSms.save();
    return scheduledSms;
  }

  async delete(id) {
    return ScheduledSms.findByIdAndUpdate(
      id,
      { isActive: false, status: 'cancelled' },
      { new: true }
    );
  }

  async toggleActive(id, isActive) {
    return ScheduledSms.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );
  }

  async executeNow(id) {
    const scheduledSms = await ScheduledSms.findById(id);
    if (!scheduledSms) throw new Error('پیامک شرطی یافت نشد');

    // ایجاد job برای اجرای فوری
    const result = await this.processScheduledSms(scheduledSms);
    return result;
  }

  async getStatistics() {
    const [total, pending, processing, completed, failed, active] = await Promise.all([
      ScheduledSms.countDocuments(),
      ScheduledSms.countDocuments({ status: 'pending' }),
      ScheduledSms.countDocuments({ status: 'processing' }),
      ScheduledSms.countDocuments({ status: 'completed' }),
      ScheduledSms.countDocuments({ status: 'failed' }),
      ScheduledSms.countDocuments({ isActive: true })
    ]);

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      active
    };
  }

  // متد اصلی برای پردازش و ارسال پیامک
  async processScheduledSms(scheduledSms) {
    try {
      // Ensure SMS service is available
      const smsService = this.smsService || getSmsServiceInstance();

      scheduledSms.status = 'processing';
      scheduledSms.execution.lastRunAt = new Date();
      await scheduledSms.save();

      // یافتن کاربران بر اساس فیلترها
      const users = await this.findUsersMatchingFilters(scheduledSms.filters);
      
      scheduledSms.execution.totalRecipients = users.length;
      await scheduledSms.save();

      // ارسال پیامک به کاربران (اینجا باید با سرویس SMS ادغام شود)
      let sentCount = 0;
      let failedCount = 0;

      for (const user of users) {
        try {
          await smsService.sendPlainSMS(
            user.mobileNumber,
            scheduledSms.message,
            null,
            'filtered',
            { recipientCount: users.length }
          );
          sentCount++;
        } catch (error) {
          failedCount++;
          console.error(`Failed to send SMS to ${user.mobileNumber}:`, error);
        }
      }

      scheduledSms.execution.sentCount = sentCount;
      scheduledSms.execution.failedCount = failedCount;
      scheduledSms.status = 'completed';

      // اگر تکراری است، زمان اجرای بعدی را محاسبه کن
      if (scheduledSms.isRecurring && scheduledSms.cronExpression) {
        const interval = parser.parseExpression(scheduledSms.cronExpression);
        scheduledSms.execution.nextRunAt = interval.next().toDate();
        scheduledSms.status = 'pending'; // برای اجرای بعدی آماده شود
      }

      await scheduledSms.save();

      return {
        totalRecipients: users.length,
        sentCount,
        failedCount
      };
    } catch (error) {
      scheduledSms.status = 'failed';
      scheduledSms.execution.errorMessage = error.message;
      await scheduledSms.save();
      throw error;
    }
  }

  // یافتن کاربران بر اساس فیلترها
  async findUsersMatchingFilters(filters) {
    const query = { mobileNumber: { $exists: true, $ne: null } };

    // فیلتر نوع کاربر
    if (filters.userType && filters.userType !== 'all') {
      query.isSpecial = filters.userType === 'special';
    }

    // فیلتر سطح کاربر
    if (filters.userLevels && filters.userLevels.length > 0) {
      query.level = { $in: filters.userLevels };
    }

    // فیلتر بازه موجودی
    if (filters.balanceRange) {
      if (filters.balanceRange.min !== undefined) {
        query['balance.IRT'] = query['balance.IRT'] || {};
        query['balance.IRT'].$gte = filters.balanceRange.min;
      }
      if (filters.balanceRange.max !== undefined) {
        query['balance.IRT'] = query['balance.IRT'] || {};
        query['balance.IRT'].$lte = filters.balanceRange.max;
      }
    }

    // فیلتر بازه ثبت‌نام
    if (filters.registrationDateRange) {
      if (filters.registrationDateRange.from) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$gte = new Date(filters.registrationDateRange.from);
      }
      if (filters.registrationDateRange.to) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$lte = new Date(filters.registrationDateRange.to);
      }
    }

    // فیلتر وضعیت احراز
    if (filters.verificationStatus && filters.verificationStatus !== 'all') {
      query.isVerified = filters.verificationStatus === 'verified';
    }

    // فیلتر وضعیت حساب
    if (filters.accountStatus && filters.accountStatus !== 'all') {
      query.isActive = filters.accountStatus === 'active';
    }

    // فیلتر موجودی طلا
    if (filters.goldBalanceRange) {
      if (filters.goldBalanceRange.min !== undefined) {
        query['balance.gold'] = query['balance.gold'] || {};
        query['balance.gold'].$gte = filters.goldBalanceRange.min;
      }
      if (filters.goldBalanceRange.max !== undefined) {
        query['balance.gold'] = query['balance.gold'] || {};
        query['balance.gold'].$lte = filters.goldBalanceRange.max;
      }
    }

    // فیلتر موجودی نقره
    if (filters.silverBalanceRange) {
      if (filters.silverBalanceRange.min !== undefined) {
        query['balance.silver'] = query['balance.silver'] || {};
        query['balance.silver'].$gte = filters.silverBalanceRange.min;
      }
      if (filters.silverBalanceRange.max !== undefined) {
        query['balance.silver'] = query['balance.silver'] || {};
        query['balance.silver'].$lte = filters.silverBalanceRange.max;
      }
    }

    const users = await User.find(query).select('mobileNumber username email').lean();
    return users;
  }

  // متد برای پیدا کردن پیامک‌هایی که باید اجرا شوند (برای Cron استفاده می‌شود)
  async findPendingScheduledSms() {
    const now = new Date();
    return ScheduledSms.find({
      isActive: true,
      status: 'pending',
      'execution.nextRunAt': { $lte: now }
    });
  }
}

module.exports = ScheduledSmsService;
