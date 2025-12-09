// One-off plain SMS sender using Kavenegar "Send" (non-template)
// Usage:
//   KAVENEGAR_API_KEY=... KAVENEGAR_SENDER=20006000646 node sms/send-plain-once.js "09120315101" "متن تست خط جدید"

const Kavenegar = require('kavenegar');

const apiKey = process.env.KAVENEGAR_API_KEY || '4B37447A59365645492B5A52646F674E785474384F6D75373872396C6E5A334C5A31367650576A306E73673D';
const sender = process.env.KAVENEGAR_SENDER || '20006000646';
const receptor = process.argv[2];
const message = process.argv[3] || 'تست خط جدید پیامک';

if (!receptor) {
    console.error('❌ Please provide receptor mobile number as first argument.');
    process.exit(1);
}

const api = Kavenegar.KavenegarApi({ apikey: apiKey });

console.log('📨 Sending plain SMS', { receptor, sender, message });

api.Send({
    message,
    sender,
    receptor
}, (response, status) => {
    if (status === 200) {
        console.log('✅ SMS sent successfully:', response);
        process.exit(0);
    } else {
        console.error('❌ SMS failed:', status, response);
        process.exit(1);
    }
});
