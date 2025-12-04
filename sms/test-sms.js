const Kavenegar = require('kavenegar');

// Initialize Kavenegar API
const api = Kavenegar.KavenegarApi({
    apikey: '4B37447A59365645492B5A52646F674E785474384F6D75373872396C6E5A334C5A31367650576A306E73673D'
});

// First, check account info
console.log('=== Checking Account Info ===\n');

api.AccountInfo((response, status) => {
    console.log('Account Info Status:', status);
    if (status === 200 && response) {
        console.log('Account Details:', JSON.stringify(response, null, 2));
    } else {
        console.log('Could not fetch account info');
    }
    
    console.log('\n=== Sending Test SMS ===\n');
    console.log('API Key:', '4B37...3D');
    console.log('Sender:', '2000660110');
    console.log('Receptor:', '09120315101');
    
    // Try sending SMS
    api.Send({
        message: "تست",
        sender: "2000660110",
        receptor: "09120315101"
    }, (response, status) => {
        console.log('\n--- Response Details ---');
        console.log('Status Code:', status);
        console.log('Response:', response);
        
        if (status === 200) {
            console.log('✅ SMS sent successfully!');
            if (response && response.entries) {
                console.log('Message ID:', response.entries[0].messageid);
                console.log('Cost:', response.entries[0].cost);
            }
        } else {
            console.error('❌ Failed to send SMS');
            console.error('Error Code:', status);
            
            // Error code meanings
            const errors = {
                200: 'عملیات موفق',
                400: 'پارامترها ناقص است',
                401: 'حساب کاربری غیرفعال شده',
                402: 'عملیات ناموفق',
                403: 'کد API نامعتبر است',
                406: 'سرور قادر به پاسخگویی نمی‌باشد',
                407: 'خطا در اعتبار سنجی',
                409: 'سرور قادر به پاسخگویی نمی‌باشد',
                411: 'گیرنده نامعتبر است',
                412: 'فرستنده نامعتبر است',
                413: 'پیام خالی است',
                414: 'طول پیام بیش از حد مجاز است',
                415: 'گیرنده‌ها خالی هستند',
                416: 'تاریخ ارسال نامعتبر است',
                417: 'خطا در ارسال پیامک',
                418: 'اعتبار کافی نیست',
                422: 'دسترسی محدود شده',
                427: 'محدودیت روزانه یا شماره گیرنده محدود شده',
                428: 'محدودیت ارسال به این شماره',
                429: 'محدودیت هماهنگ سازی',
            };
            
            console.error('Error Description:', errors[status] || 'خطای نامشخص');
            console.error('\n💡 راه‌حل‌های ممکن:');
            console.error('1. بررسی موجودی حساب کاوه‌نگار');
            console.error('2. بررسی محدودیت روزانه');
            console.error('3. بررسی اینکه شماره گیرنده در لیست سیاه نباشد');
            console.error('4. تماس با پشتیبانی کاوه‌نگار');
        }
    });
});
