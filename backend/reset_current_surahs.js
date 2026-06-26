/**
 * reset_current_surahs.js
 * يعيد ضبط حقل currentSurah لكل الطلاب ليساوي startSurah في قاعدة البيانات المحلية
 * الاستخدام: node backend/reset_current_surahs.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { sequelize } = require('./config/db');
const Student = require('./models/Student');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // جلب كل الطلاب
    const students = await Student.findAll();
    console.log(`📋 عدد الطلاب: ${students.length}`);

    let updatedCount = 0;

    for (const student of students) {
      if (student.startSurah) {
        await student.update({ currentSurah: student.startSurah });
        console.log(`  ✔ ${student.name}: currentSurah → ${student.startSurah}`);
        updatedCount++;
      } else {
        console.log(`  ⚠ ${student.name}: لا توجد بداية سورة، تم تخطيه`);
      }
    }

    console.log(`\n🎉 تم إعادة ضبط ${updatedCount} طالب بنجاح`);
    process.exit(0);
  } catch (err) {
    console.error('❌ خطأ:', err.message);
    process.exit(1);
  }
})();
