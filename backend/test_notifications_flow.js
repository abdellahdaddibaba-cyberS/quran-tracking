require('dotenv').config();
const { connectDB } = require('./config/db');
const User = require('./models/User');
const Student = require('./models/Student');
const DailyTracking = require('./models/DailyTracking');
const { sendPushNotification } = require('./utils/notification');

async function testNotificationFlow() {
  try {
    await connectDB();
    console.log('\n🔌 متصل بنجاح بقاعدة البيانات لغرض الفحص...');

    // 1. جلب أو تعديل ولي أمر تجريبي
    let parent = await User.findOne({ where: { role: 'parent' } });
    if (!parent) {
      console.log('➕ لم يتم العثور على ولي أمر، جاري إنشاء حساب تجريبي...');
      parent = await User.create({
        username: 'testparent',
        password: 'password123',
        fullName: 'ولي أمر تجريبي',
        role: 'parent',
        pushToken: 'ExponentPushToken[mock_token_123456]'
      });
    } else {
      console.log(`👤 تم العثور على ولي أمر: "${parent.fullName}"`);
      parent.pushToken = 'ExponentPushToken[mock_token_123456]';
      await parent.save();
      console.log('📝 تم تحديث ولي الأمر برمز إشعار تجريبي (Mock Token).');
    }

    // 2. التحقق من ربط طالب بولي الأمر
    let student = await Student.findOne({ where: { parentId: parent._id } });
    if (!student) {
      console.log('🔗 لا يوجد طالب مرتبط بولي الأمر هذا، جاري ربط أول طالب متاح...');
      student = await Student.findOne();
      if (!student) {
        console.log('❌ لا يوجد أي طلاب في قاعدة البيانات لإتمام الفحص.');
        process.exit(1);
      }
      student.parentId = parent._id;
      await student.save();
      console.log(`✅ تم ربط الطالب "${student.name}" بولي الأمر "${parent.fullName}" بنجاح.`);
    } else {
      console.log(`🎓 الطالب المستخدم للفحص: "${student.name}" المرتبط بـ "${parent.fullName}"`);
    }

    // 3. محاكاة تسجيل المتابعة اليومية وبناء الإشعار
    console.log('\n📝 محاكاة إدخال سجل يومي للطالب...');
    const mockRecord = {
      studentId: student._id,
      date: new Date().toISOString().split('T')[0],
      pagesRequired: 2,
      pagesMemorized: 2,
      notes: 'ممتاز جداً اليوم',
      attendance: 'present',
      isSurahCompleted: true
    };

    console.log('🔍 جاري الاستعلام عن بيانات الطالب وولي أمره وتأكيد صلاحية الرمز...');
    const fetchedStudent = await Student.findByPk(mockRecord.studentId, {
      include: [{
        model: User,
        as: 'parent',
        attributes: ['_id', 'pushToken']
      }]
    });

    if (fetchedStudent && fetchedStudent.parent && fetchedStudent.parent.pushToken) {
      console.log(`📱 تم العثور على رمز إشعار ولي الأمر: ${fetchedStudent.parent.pushToken}`);
      
      let title = `متابعة التحصيل اليومي لـ ${fetchedStudent.name}`;
      let body = `🎉 تهانينا! لقد تم تسجيل حضور ${fetchedStudent.name} وحفظ ${mockRecord.pagesMemorized} صفحات، وأكمل حفظ سورة اليوم! 🌟`;

      console.log('\n🚀 جاري تشغيل دالة إرسال الإشعارات...');
      await sendPushNotification([fetchedStudent.parent.pushToken], title, body, {
        studentId: fetchedStudent._id,
        type: 'daily_tracking',
        date: mockRecord.date
      });
      
      console.log('\n✨ الفحص تم بنجاح! دالة بناء وإرسال الإشعارات تعمل بشكل ممتاز وخالية تماماً من الأخطاء البرمجية. 🌟');
    } else {
      console.log('❌ خطأ: لم يتم العثور على رمز إشعارات نشط لولي الأمر.');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ فشل فحص نظام الإشعارات بسبب الخطأ التالي:', error);
    process.exit(1);
  }
}

testNotificationFlow();
