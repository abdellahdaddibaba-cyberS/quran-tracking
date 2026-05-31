const { sendPushNotification } = require('./utils/notification');

// استبدل هذا الرمز بالرمز الحقيقي الذي يظهر في كونسول الهاتف (Expo Console) عند تشغيل التطبيق
const TEST_EXPO_PUSH_TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

async function testPush() {
  if (TEST_EXPO_PUSH_TOKEN.includes('xxxxxx')) {
    console.log('⚠️ يرجى استبدال TEST_EXPO_PUSH_TOKEN بالرمز الحقيقي المعروض في كونسول الهاتف أولاً.');
    return;
  }

  console.log(`⏳ جاري إرسال إشعار تجريبي إلى: ${TEST_EXPO_PUSH_TOKEN}...`);
  
  try {
    await sendPushNotification(
      [TEST_EXPO_PUSH_TOKEN],
      'تجربة إشعارات مدرسة النور 🌟',
      '🎉 أهلاً بك! تم إرسال هذا الإشعار بنجاح للتأكد من ربط نظام المتابعة بهاتفك.',
      { test: true }
    );
    console.log('✅ تم إرسال طلب الإشعار إلى خوادم إكسبو بنجاح. يرجى التحقق من هاتفك!');
  } catch (error) {
    console.error('❌ حدث خطأ أثناء إرسال الإشعار التجريبي:', error.message);
  }
}

testPush();
