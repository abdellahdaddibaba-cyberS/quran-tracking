const { Expo } = require('expo-server-sdk');

// تهيئة عميل إكسبو للإشعارات
let expo = new Expo();

/**
 * إرسال إشعارات الدفع لهواتف أولياء الأمور
 * @param {string[]} tokens - مصفوفة من رموز إشعارات إكسبو
 * @param {string} title - عنوان الإشعار
 * @param {string} body - نص الإشعار
 * @param {object} [data] - بيانات إضافية اختيارية
 */
const sendPushNotification = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return;

  // تصفية الرموز الصالحة فقط
  const cleanTokens = tokens.filter(token => Expo.isExpoPushToken(token));
  if (cleanTokens.length === 0) {
    console.log('⚠️ لا توجد رموز إشعارات إكسبو صالحة لإرسالها.');
    return;
  }

  let messages = [];
  for (let pushToken of cleanTokens) {
    messages.push({
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
    });
  }

  // تقسيم الرسائل إلى حزم (Chunks) وفقاً لمتطلبات إكسبو
  let chunks = expo.chunkPushNotifications(messages);
  let tickets = [];
  
  for (let chunk of chunks) {
    try {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
      console.log('✅ تم إرسال حزمة إشعارات بنجاح:', ticketChunk);
    } catch (error) {
      console.error('❌ خطأ أثناء إرسال حزمة إشعارات:', error);
    }
  }
};

module.exports = { sendPushNotification };
