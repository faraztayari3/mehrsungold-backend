const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function generateReport(startDate, endDate) {
  await mongoose.connect(process.env.DATABASE_URI);
  
  console.log(`در حال تولید گزارش از ${startDate} تا ${endDate}...`);
  
  // Query transactions with user and tradeable info
  const transactions = await mongoose.connection.db.collection('transactions')
    .aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $lookup: {
          from: 'tradeables',
          localField: 'tradeable',
          foreignField: '_id',
          as: 'tradeableInfo'
        }
      }
    ])
    .toArray();
  
  console.log(`تعداد معاملات یافت شده: ${transactions.length}`);
  
  // Prepare data for Excel - matching exact format of existing reports
  const data = transactions.map((t, index) => {
    const user = t.userInfo && t.userInfo[0] ? t.userInfo[0] : {};
    const tradeable = t.tradeableInfo && t.tradeableInfo[0] ? t.tradeableInfo[0] : {};
    
    // Map tradeable name to Persian
    let tradeableName = 'نامشخص';
    if (tradeable.name) {
      if (tradeable.name === 'GOLD' || tradeable.name === 'طلا') tradeableName = 'طلا';
      else if (tradeable.name === 'SILVER' || tradeable.name === 'نقره') tradeableName = 'نقره';
      else tradeableName = tradeable.name;
    }
    
    // Map type to Persian
    const typeFa = t.type === 'Buy' ? 'خرید' : 'فروش';
    
    return {
      'جنس': tradeableName,
      'نوع': typeFa,
      'میزان (گرم)': t.amount || 0,
      'کارمزد': t.wage || 0,
      'مبلغ': t.total || 0,
      'مبلغ واحد': t.tradeablePrice || 0,
      'وضعیت': t.status || '',
      'ناریخ': t.jalaliDate || '',
      'نام خانوادگی': user.lastName || '',
      'نام': user.firstName || '',
      'شماره موبایل': user.mobileNumber || ''
    };
  });
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data, { header: Object.keys(data[0] || {}) });
  
  // Set column widths to match original report format
  ws['!cols'] = [
    { wch: 10 }, // جنس
    { wch: 8 },  // نوع
    { wch: 15 }, // میزان (گرم)
    { wch: 15 }, // کارمزد
    { wch: 15 }, // مبلغ
    { wch: 15 }, // مبلغ واحد
    { wch: 12 }, // وضعیت
    { wch: 20 }, // تاریخ
    { wch: 18 }, // نام خانوادگی
    { wch: 15 }, // نام
    { wch: 15 }, // شماره موبایل
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  
  // Generate filename
  const filename = `گزارش-معاملات-${startDate}-تا-${endDate}.xlsx`;
  const filepath = path.join(process.cwd(), 'Downloads', filename);
  
  // Create Downloads directory if not exists
  if (!fs.existsSync(path.join(process.cwd(), 'Downloads'))) {
    fs.mkdirSync(path.join(process.cwd(), 'Downloads'));
  }
  
  // Write file
  XLSX.writeFile(wb, filepath);
  
  console.log(`✓ فایل با موفقیت ساخته شد: ${filepath}`);
  console.log(`حجم فایل: ${Math.round(fs.statSync(filepath).size / 1024)} KB`);
  
  await mongoose.disconnect();
}

const startDate = process.argv[2] || '2025-12-07';
const endDate = process.argv[3] || '2025-12-15';

generateReport(startDate, endDate).catch(err => {
  console.error('خطا:', err);
  process.exit(1);
});
