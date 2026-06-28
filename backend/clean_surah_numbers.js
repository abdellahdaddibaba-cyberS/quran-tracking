/**
 * clean_surah_numbers.js
 * يزيل أرقام الآيات من حقلي startSurah و currentSurah لكل الطلاب
 * مثال: "الكهف - 5" → "الكهف"  |  "البقرة:25" → "البقرة"
 * الاستخدام: node backend/clean_surah_numbers.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { sequelize } = require('./config/db');
const Student = require('./models/Student');

/**
 * يزيل رقم الآية من اسم السورة ويُعيد الاسم نظيفاً
 * يدعم الصيغ: "الكهف - 5", "الكهف:5", "الكهف 5", "الكهف - آية 5", "الكهف/5"
 */
function cleanSurahName(raw) {
  if (!raw) return raw;
  return raw
    .replace(/[\s\-–:\/،,]+آية\s*\d+/g, '')   // ... - آية 5
    .replace(/[\s\-–:\/،,]+\d+/g, '')           // ... - 5  |  ...:5  |  ... 5
    .trim();
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ تم الاتصال بقاعدة البيانات');

    const students = await Student.findAll();
    console.log(`📋 عدد الطلاب: ${students.length}\n`);

    let updatedCount = 0;

    for (const student of students) {
      const cleanStart   = cleanSurahName(student.startSurah);
      const cleanCurrent = cleanSurahName(student.currentSurah);

      const needsUpdate =
        cleanStart   !== student.startSurah ||
        cleanCurrent !== student.currentSurah;

      if (needsUpdate) {
        await student.update({
          startSurah:   cleanStart,
          currentSurah: cleanCurrent || cleanStart,
        });
        console.log(`  ✔ ${student.name}`);
        if (cleanStart !== student.startSurah)
          console.log(`     startSurah:   "${student.startSurah}" → "${cleanStart}"`);
        if (cleanCurrent !== student.currentSurah)
          console.log(`     currentSurah: "${student.currentSurah}" → "${cleanCurrent}"`);
        updatedCount++;
      } else {
        console.log(`  — ${student.name}: لا يحتاج تعديل (${student.startSurah})`);
      }
    }

    console.log(`\n🎉 تم تنظيف ${updatedCount} طالب بنجاح`);
    process.exit(0);
  } catch (err) {
    console.error('❌ خطأ:', err.message);
    process.exit(1);
  }
})();
