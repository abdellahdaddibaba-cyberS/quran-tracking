/**
 * فحص شامل لنظام الإشعارات — تشغيل: npm run test:notifications
 */
require('dotenv').config();
const { Op } = require('sequelize');
const { connectDB } = require('./config/db');
const User = require('./models/User');
const Student = require('./models/Student');
const { sendPushNotification } = require('./utils/notification');

async function runDiagnostics() {
  console.log('\n🔔 === فحص نظام الإشعارات ===\n');

  await connectDB();

  // 1) Parents & tokens
  const parents = await User.findAll({
    where: { role: 'parent' },
    attributes: ['_id', 'username', 'fullName', 'pushToken'],
    order: [['fullName', 'ASC']],
  });

  console.log('👨‍👩‍👧 أولياء الأمور:');
  let validTokenCount = 0;
  for (const p of parents) {
    const token = p.pushToken;
    const isMock = token && token.includes('mock_token');
    const isValid = token && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) && !isMock;
    if (isValid) validTokenCount += 1;
    console.log(
      `  • ${p.fullName} (@${p.username}) → ${isValid ? '✅ رمز حقيقي' : token ? '⚠️ رمز غير صالح/تجريبي' : '❌ بدون رمز'}`
    );
    if (token) console.log(`    ${token.slice(0, 55)}...`);
    if (isMock) {
      await User.update({ pushToken: null }, { where: { _id: p._id } });
      console.log('    🧹 تم مسح الرمز التجريبي — سجّل الدخول من الهاتف لحفظ رمز حقيقي');
    }
  }

  // 2) Student-parent links
  const students = await Student.findAll({
    where: { parentId: { [Op.ne]: null } },
    attributes: ['_id', 'name', 'parentId'],
  });
  console.log(`\n🎓 طلاب مربوطون بأولياء أمور: ${students.length}`);

  // 3) Simulate tracking notification query (the fixed code path)
  console.log('\n🧪 محاكاة استعلام الإشعار بعد حفظ التحصيل...');
  try {
    const sampleStudentId = students[0]?._id;
    if (!sampleStudentId) {
      console.log('❌ لا يوجد طلاب مربوطون — لن تُرسل إشعارات');
    } else {
      const found = await Student.findAll({
        where: { _id: { [Op.in]: [sampleStudentId] } },
        include: [{ model: User, as: 'parent', attributes: ['_id', 'pushToken', 'fullName'] }],
      });
      const s = found[0];
      console.log(`  ✅ استعلام Sequelize ناجح — الطالب: ${s?.name}, ولي الأمر: ${s?.parent?.fullName || '—'}`);
    }
  } catch (err) {
    console.log(`  ❌ فشل الاستعلام: ${err.message}`);
  }

  // 4) Optional live push test
  const tokenArg = process.argv[2];
  const testToken = tokenArg || parents.find((p) => p.pushToken && !p.pushToken.includes('mock_token'))?.pushToken;

  if (testToken) {
    console.log('\n📤 إرسال إشعار تجريبي...');
    const result = await sendPushNotification(
      [testToken],
      'اختبار نظام الإشعارات 🔔',
      'إذا وصلك هذا الإشعار، النظام يعمل بنجاح!',
      { type: 'test' }
    );
    console.log('  النتيجة:', JSON.stringify(result, null, 2));
  } else {
    console.log('\n⚠️ لا يوجد رمز Expo حقيقي للاختبار.');
    console.log('   1) افتح تطبيق ولي الأمر على جهاز حقيقي');
    console.log('   2) سجّل الدخول واسمح بالإشعارات');
    console.log('   3) من الإعدادات → «اختبار الإشعار»');
    console.log('   أو: node test_notifications_diagnostic.js ExponentPushToken[...]');
  }

  console.log('\n✅ انتهى الفحص\n');
  process.exit(0);
}

runDiagnostics().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
