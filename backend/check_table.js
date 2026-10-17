const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
  try {
    // اختبار تحميل النموذج مباشرة
    const PasswordChangeLog = require('./models/PasswordChangeLog');
    console.log('✅ Model loaded:', PasswordChangeLog.name);

    // جلب البيانات
    const logs = await PasswordChangeLog.findAll({
      order: [['changedAt', 'DESC']],
      limit: 10
    });
    console.log('✅ Records found:', logs.length);
    logs.forEach(l => console.log(' -', l.username, l.fullName, l.changedAt));

    process.exit(0);
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
