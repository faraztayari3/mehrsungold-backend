const cron = require('node-cron');
const ScheduledSmsService = require('./scheduled-sms.service');

class SmsScheduler {
  constructor() {
    this.scheduledSmsService = new ScheduledSmsService();
    this.isRunning = false;
  }

  // شروع Cron Job - هر دقیقه چک می‌کند
  start() {
    if (this.isRunning) {
      console.log('⚠️  SMS Scheduler is already running');
      return;
    }

    console.log('🕐 Starting SMS Scheduler...');
    
    // هر دقیقه یک بار چک می‌کند
    this.job = cron.schedule('* * * * *', async () => {
      await this.checkAndExecutePendingSms();
    });

    this.isRunning = true;
    console.log('✅ SMS Scheduler started successfully');
  }

  // متوقف کردن Cron Job
  stop() {
    if (this.job) {
      this.job.stop();
      this.isRunning = false;
      console.log('🛑 SMS Scheduler stopped');
    }
  }

  // چک کردن و اجرای پیامک‌های در انتظار
  async checkAndExecutePendingSms() {
    try {
      const pendingSmsList = await this.scheduledSmsService.findPendingScheduledSms();
      
      if (pendingSmsList.length === 0) {
        return;
      }

      console.log(`📬 Found ${pendingSmsList.length} pending scheduled SMS to process`);

      for (const scheduledSms of pendingSmsList) {
        try {
          console.log(`📤 Processing scheduled SMS: ${scheduledSms.name} (${scheduledSms._id})`);
          await this.scheduledSmsService.processScheduledSms(scheduledSms);
          console.log(`✅ Successfully processed: ${scheduledSms.name}`);
          
          // ایجاد نوتیفیکیشن موفقیت
          await this.createNotification({
            type: 'success',
            title: 'ارسال پیامک موفقیت‌آمیز',
            message: `پیامک "${scheduledSms.name}" با موفقیت به ${scheduledSms.execution.sentCount} نفر ارسال شد`,
            userId: scheduledSms.createdBy,
            relatedId: scheduledSms._id,
            relatedModel: 'ScheduledSms'
          });
          
        } catch (error) {
          console.error(`❌ Failed to process ${scheduledSms.name}:`, error);
          
          // ایجاد نوتیفیکیشن خطا
          await this.createNotification({
            type: 'error',
            title: 'خطا در ارسال پیامک',
            message: `پیامک "${scheduledSms.name}" با خطا مواجه شد: ${error.message}`,
            userId: scheduledSms.createdBy,
            relatedId: scheduledSms._id,
            relatedModel: 'ScheduledSms'
          });
        }
      }
    } catch (error) {
      console.error('❌ Error in SMS scheduler:', error);
    }
  }

  // ایجاد نوتیفیکیشن
  async createNotification(data) {
    try {
      // این قسمت باید با سیستم notification شما ادغام شود
      // فعلاً فقط لاگ می‌کنیم
      console.log('📢 Notification:', data);
      
      // اگر NotificationModel دارید:
      // const Notification = require('../notification/notification.schema');
      // await Notification.create(data);
      
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  // اجرای دستی (برای تست)
  async runManually() {
    console.log('🔄 Running SMS scheduler manually...');
    await this.checkAndExecutePendingSms();
  }
}

module.exports = SmsScheduler;
