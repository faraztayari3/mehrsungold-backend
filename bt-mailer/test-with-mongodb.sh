#!/bin/bash

# رنگ‌ها برای خروجی
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "================================================================================"
echo "🧪 تست کامل سیستم پیامک با MongoDB Change Streams"
echo "================================================================================"
echo ""

# چک کردن اینکه آیا watch-balance-transactions.js در حال اجراست یا نه
echo -e "${BLUE}📋 چک کردن وضعیت سرویس...${NC}"
if pgrep -f "watch-balance-transactions.js" > /dev/null; then
    echo -e "${GREEN}✅ سرویس در حال اجراست${NC}"
    PID=$(pgrep -f "watch-balance-transactions.js")
    echo -e "${YELLOW}   PID: $PID${NC}"
else
    echo -e "${YELLOW}⚠️  سرویس در حال اجرا نیست${NC}"
    echo -e "${BLUE}   در حال راه‌اندازی سرویس...${NC}"
    cd /Users/faraz/Desktop/Repo/Back/mehrsungold-backend/bt-mailer
  # Safe default: never send real SMS during tests unless explicitly enabled.
  SMS_MODE="${SMS_MODE:-dry-run}" node watch-balance-transactions.js > /tmp/bt-mailer.log 2>&1 &
    sleep 3
    echo -e "${GREEN}✅ سرویس راه‌اندازی شد${NC}"
    echo -e "${YELLOW}   لاگ‌ها در /tmp/bt-mailer.log${NC}"
fi

echo ""
echo "================================================================================"
echo "📝 راهنمای تست با MongoDB Shell یا Compass"
echo "================================================================================"
echo ""

echo -e "${BLUE}1️⃣  تست خوش‌آمدگویی (بعد از تأیید OTP):${NC}"
echo -e "   ${YELLOW}// ابتدا یک کاربر جدید اضافه کنید:${NC}"
cat << 'EOF'
   db.users.insertOne({
     firstName: "تست",
     lastName: "کاربر",
     mobileNumber: "09123456789",
     role: "User",
     verificationStatus: "NotVerified",
     verificationCode: "1234",
     tomanBalance: 0,
     createdAt: new Date()
   })
EOF
echo ""
echo -e "   ${YELLOW}// سپس برای شبیه‌سازی تأیید OTP:${NC}"
echo '   db.users.updateOne({ mobileNumber: "09123456789" }, { $set: { verificationCode: null } })'
echo ""

echo -e "${BLUE}2️⃣  تست تأیید احراز هویت:${NC}"
echo '   db.users.updateOne({ mobileNumber: "09123456789" }, { $set: { verificationStatus: "FirstLevelVerified" } })'
echo ""

echo -e "${BLUE}3️⃣  تست رد احراز هویت:${NC}"
cat << 'EOF'
   db.users.updateOne(
     { mobileNumber: "09123456789" },
     { $set: {
         verificationStatus: "FirstLevelRejected",
         verifyDescription: "تصویر مدارک واضح نیست"
       }
     }
   )
EOF
echo ""

echo -e "${BLUE}4️⃣  تست تغییر رمز عبور:${NC}"
echo '   db.users.updateOne({ mobileNumber: "09123456789" }, { $set: { password: "newhashedpassword123" } })'
echo ""

echo -e "${BLUE}5️⃣  تست واریز:${NC}"
echo -e "   ${YELLOW}// ابتدا یک تراکنش واریز جدید ایجاد کنید:${NC}"
cat << 'EOF'
   var user = db.users.findOne({ mobileNumber: "09123456789" });
   db.balancetransactions.insertOne({
     type: "OnlineDeposit",
     amount: 1000000,
     status: "Pending",
     user: user._id,
     createdAt: new Date(),
     updatedAt: new Date()
   })
EOF
echo ""
echo -e "   ${YELLOW}// سپس برای تأیید واریز:${NC}"
cat << 'EOF'
   var tx = db.balancetransactions.findOne({ type: "OnlineDeposit", status: "Pending" });
   db.balancetransactions.updateOne(
     { _id: tx._id },
     { $set: { status: "Accepted", updatedAt: new Date() } }
   )
   // همچنین موجودی کاربر را به‌روز کنید:
   db.users.updateOne(
     { _id: tx.user },
     { $inc: { tomanBalance: tx.amount } }
   )
EOF
echo ""

echo -e "${BLUE}6️⃣  تست رد واریز:${NC}"
cat << 'EOF'
   var tx = db.balancetransactions.findOne({ type: "OnlineDeposit", status: "Pending" });
   db.balancetransactions.updateOne(
     { _id: tx._id },
     { $set: {
         status: "Rejected",
         confirmDescription: "مبلغ واریزی با درخواست مطابقت ندارد",
         updatedAt: new Date()
       }
     }
   )
EOF
echo ""

echo -e "${BLUE}7️⃣  تست برداشت:${NC}"
echo -e "   ${YELLOW}// ابتدا یک تراکنش برداشت جدید ایجاد کنید:${NC}"
cat << 'EOF'
   var user = db.users.findOne({ mobileNumber: "09123456789" });
   db.balancetransactions.insertOne({
     type: "Withdraw",
     amount: 500000,
     status: "Pending",
     user: user._id,
     createdAt: new Date(),
     updatedAt: new Date()
   })
EOF
echo ""
echo -e "   ${YELLOW}// سپس برای تأیید برداشت:${NC}"
cat << 'EOF'
   var tx = db.balancetransactions.findOne({ type: "Withdraw", status: "Pending" });
   db.balancetransactions.updateOne(
     { _id: tx._id },
     { $set: {
         status: "Accepted",
         trackingCode: "TRK-" + Math.floor(Math.random() * 1000000),
         updatedAt: new Date()
       }
     }
   )
   // همچنین موجودی کاربر را کم کنید:
   db.users.updateOne(
     { _id: tx.user },
     { $inc: { tomanBalance: -tx.amount } }
   )
EOF
echo ""

echo -e "${BLUE}8️⃣  تست خرید طلا:${NC}"
echo -e "   ${YELLOW}// ابتدا یک تراکنش خرید جدید ایجاد کنید:${NC}"
cat << 'EOF'
   var user = db.users.findOne({ mobileNumber: "09123456789" });
   var goldTradeable = db.tradeables.findOne({ symbol: "XAU" });
   db.transactions.insertOne({
     type: "buy",
     amount: 1.5,
     total: 2500000,
     status: "Pending",
     tradeable: goldTradeable._id,
     user: user._id,
     createdAt: new Date(),
     updatedAt: new Date()
   })
EOF
echo ""
echo -e "   ${YELLOW}// سپس برای تأیید خرید:${NC}"
cat << 'EOF'
   var tx = db.transactions.findOne({ type: "buy", status: "Pending" });
   db.transactions.updateOne(
     { _id: tx._id },
     { $set: { status: "Accepted", updatedAt: new Date() } }
   )
   // همچنین موجودی کاربر را به‌روز کنید:
   db.users.updateOne(
     { _id: tx.user },
     {
       $inc: {
         goldBalance: tx.amount,
         tomanBalance: -tx.total
       }
     }
   )
EOF
echo ""

echo -e "${BLUE}9️⃣  تست فروش نقره:${NC}"
cat << 'EOF'
   var user = db.users.findOne({ mobileNumber: "09123456789" });
   var silverTradeable = db.tradeables.findOne({ symbol: "XAG" });
   db.transactions.insertOne({
     type: "sell",
     amount: 0.5,
     total: 800000,
     status: "Accepted",
     tradeable: silverTradeable._id,
     user: user._id,
     createdAt: new Date(),
     updatedAt: new Date()
   })
   // موجودی کاربر را به‌روز کنید:
   db.users.updateOne(
     { _id: user._id },
     {
       $inc: {
         silverBalance: -0.5,
         tomanBalance: 800000
       }
     }
   )
EOF
echo ""

echo "================================================================================"
echo -e "${GREEN}✅ راهنما نمایش داده شد${NC}"
echo "================================================================================"
echo ""
echo -e "${YELLOW}📌 نکات:${NC}"
echo "   • برای اجرای دستورات بالا از MongoDB Shell یا Compass استفاده کنید"
echo "   • پیامک‌ها به صورت خودکار به کاربر و شماره تست 09120315101 ارسال می‌شوند"
echo "   • لاگ‌های سرویس را با دستور زیر ببینید:"
echo -e "     ${BLUE}tail -f /tmp/bt-mailer.log${NC}"
echo ""
echo -e "${YELLOW}🛑 برای متوقف کردن سرویس:${NC}"
echo -e "   ${BLUE}pkill -f watch-balance-transactions.js${NC}"
echo ""
