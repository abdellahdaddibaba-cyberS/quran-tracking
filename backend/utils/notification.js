const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

const expo = new Expo();

const ANDROID_CHANNEL_ID = 'default';

function normalizePushData(data = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    normalized[key] = value == null ? '' : String(value);
  }
  return normalized;
}

async function clearInvalidToken(pushToken) {
  try {
    await User.update({ pushToken: null }, { where: { pushToken } });
    console.log('🧹 تم مسح رمز إشعار غير صالح:', pushToken);
  } catch (error) {
    console.error('Failed to clear invalid push token:', error.message);
  }
}

/**
 * إرسال إشعارات الدفع لهواتف أولياء الأمور
 */
const sendPushNotification = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return { sent: 0, errors: [] };

  const cleanTokens = [...new Set(tokens.filter((token) => Expo.isExpoPushToken(token)))];
  if (cleanTokens.length === 0) {
    console.log('⚠️ لا توجد رموز إشعارات إكسبو صالحة لإرسالها.');
    return { sent: 0, errors: ['no_valid_tokens'] };
  }

  const payloadData = normalizePushData(data);
  const messages = cleanTokens.map((pushToken) => ({
    to: pushToken,
    sound: 'default',
    title,
    body,
    data: payloadData,
    priority: 'high',
    channelId: ANDROID_CHANNEL_ID,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  const errors = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('❌ خطأ أثناء إرسال حزمة إشعارات:', error);
      errors.push(error.message);
    }
  }

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const token = cleanTokens[i];

    if (ticket.status === 'error') {
      console.error('❌ فشل إرسال إشعار:', ticket.message, ticket.details);
      errors.push(ticket.message);

      if (
        ticket.details?.error === 'DeviceNotRegistered' ||
        ticket.details?.error === 'InvalidCredentials'
      ) {
        await clearInvalidToken(token);
      }
    }
  }

  const sent = tickets.filter((t) => t.status === 'ok').length;
  if (sent > 0) {
    console.log(`✅ تم إرسال ${sent} إشعار/إشعارات بنجاح`);
  }

  return { sent, errors };
};

module.exports = { sendPushNotification };
