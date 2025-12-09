const ScheduledSmsService = require('./scheduled-sms.service');

class ScheduledSmsController {
  constructor() {
    this.scheduledSmsService = new ScheduledSmsService();
  }

  // ایجاد پیامک شرطی جدید
  async create(req, res) {
    try {
      const userId = req.user._id;
      const scheduledSms = await this.scheduledSmsService.create(req.body, userId);
      
      return res.status(201).json({
        statusCode: 201,
        message: 'پیامک شرطی با موفقیت ایجاد شد',
        data: scheduledSms
      });
    } catch (error) {
      console.error('[ScheduledSms] Create error:', error);
      return res.status(500).json({
        statusCode: 500,
        message: error.message || 'خطا در ایجاد پیامک شرطی'
      });
    }
  }

  // لیست پیامک‌های شرطی
  async getAll(req, res) {
    try {
      const { page = 1, limit = 20, status, isActive } = req.query;
      const result = await this.scheduledSmsService.getAll({ page, limit, status, isActive });
      
      return res.status(200).json({
        statusCode: 200,
        message: 'لیست پیامک‌های شرطی',
        data: result
      });
    } catch (error) {
      console.error('[ScheduledSms] GetAll error:', error);
      return res.status(500).json({
        statusCode: 500,
        message: error.message || 'خطا در دریافت لیست'
      });
    }
  }

  // جزئیات یک پیامک شرطی
  async getOne(req, res) {
    try {
      const { id } = req.params;
      const scheduledSms = await this.scheduledSmsService.getOne(id);
      
      if (!scheduledSms) {
        return res.status(404).json({
          statusCode: 404,
          message: 'پیامک شرطی یافت نشد'
        });
      }
      
      return res.status(200).json({
        statusCode: 200,
        data: scheduledSms
      });
    } catch (error) {
      console.error('[ScheduledSms] GetOne error:', error);
      return res.status(500).json({
        statusCode: 500,
        message: error.message || 'خطا در دریافت اطلاعات'
      });
    }
  }

  // ویرایش پیامک شرطی
  async update(req, res) {
    try {
      const { id } = req.params;
      const scheduledSms = await this.scheduledSmsService.update(id, req.body);
      
      if (!scheduledSms) {
        return res.status(404).json({
          statusCode: 404,
          message: 'پیامک شرطی یافت نشد'
        });
      }
      
      return res.status(200).json({
        statusCode: 200,
        message: 'پیامک شرطی با موفقیت ویرایش شد',
        data: scheduledSms
      });
    } catch (error) {
      console.error('[ScheduledSms] Update error:', error);
      return res.status(500).json({
        statusCode: 500,
        message: error.message || 'خطا در ویرایش'
      });
    }
  }

  // حذف (غیرفعال‌سازی) پیامک شرطی
  async delete(req, res) {
    try {
      const { id } = req.params;
      const scheduledSms = await this.scheduledSmsService.delete(id);
      
      if (!scheduledSms) {
        return res.status(404).json({
          statusCode: 404,
          message: 'پیامک شرطی یافت نشد'
        });
      }
      
      return res.status(200).json({
        statusCode: 200,
        message: 'پیامک شرطی با موفقیت حذف شد'
      });
    } catch (error) {
      console.error('[ScheduledSms] Delete error:', error);
      return res.status(500).json({
        statusCode: 500,
        message: error.message || 'خطا در حذف'
      });
    }
  }

  // فعال/غیرفعال کردن
  async toggleActive(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const scheduledSms = await this.scheduledSmsService.toggleActive(id, isActive);
      
      if (!scheduledSms) {
        return res.status(404).json({
          statusCode: 404,
          message: 'پیامک شرطی یافت نشد'
        });
      }
      
      return res.status(200).json({
        statusCode: 200,
        message: `پیامک شرطی ${isActive ? 'فعال' : 'غیرفعال'} شد`,
        data: scheduledSms
      });
    } catch (error) {
      console.error('[ScheduledSms] ToggleActive error:', error);
      return res.status(500).json({
        statusCode: 500,
        message: error.message || 'خطا در تغییر وضعیت'
      });
    }
  }

  // اجرای دستی
  async executeNow(req, res) {
    try {
      const { id } = req.params;
      const result = await this.scheduledSmsService.executeNow(id);
      
      return res.status(200).json({
        statusCode: 200,
        message: 'پیامک در حال ارسال است',
        data: result
      });
    } catch (error) {
      console.error('[ScheduledSms] ExecuteNow error:', error);
      return res.status(500).json({
        statusCode: 500,
        message: error.message || 'خطا در اجرای پیامک'
      });
    }
  }

  // آمار
  async getStatistics(req, res) {
    try {
      const stats = await this.scheduledSmsService.getStatistics();
      
      return res.status(200).json({
        statusCode: 200,
        data: stats
      });
    } catch (error) {
      console.error('[ScheduledSms] GetStatistics error:', error);
      return res.status(500).json({
        statusCode: 500,
        message: error.message || 'خطا در دریافت آمار'
      });
    }
  }
}

module.exports = ScheduledSmsController;
