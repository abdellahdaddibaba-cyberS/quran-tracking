const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

const expo = new Expo();

const ANDROID_CHANNEL_ID = 'default';
const RECEIPT_CHECK_DELAY_MS = 4000;

function normalizePushData(data = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    normalized[key] = value == null ? '' : String(value);
  }
  return normalized;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clearInvalidToken(pushToken) {
  try {
    await User.update({ pushToken: null }, { where: { pushToken } });
    console.log('🧹 تم مسح رمز إشعار غير صالح:', pushToken);
  } catch (error) {
    console.error('Failed to clear invalid push token:', error.message);
  }
}

async function checkReceipts(tickets, tokens) {
  const receiptIds = [];
  const tokenByReceiptId = new Map();

  tickets.forEach((ticket, index) => {
    if (ticket.status === 'ok' && ticket.id) {
      receiptIds.push(ticket.id);
      tokenByReceiptId.set(ticket.id, tokens[index]);
    }
  });

  if (receiptIds.length === 0) return [];

  await sleep(RECEIPT_CHECK_DELAY_MS);

  const receiptErrors = [];
  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  for (const chunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const [receiptId, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'ok') continue;

        receiptErrors.push({
          receiptId,
          message: receipt.message,
          details: receipt.details,
        });

        console.error('❌ فشل تسليم الإشعار:', receipt.message, receipt.details);

        const token = tokenByReceiptId.get(receiptId);
        if (
          token &&
          (receipt.details?.error === 'DeviceNotRegistered' ||
            receipt.details?.error === 'InvalidCredentials')
        ) {
          await clearInvalidToken(token);
        }
      }
    } catch (error) {
      console.error('❌ خطأ أثناء التحقق من إيصالات الإشعارات:', error.message);
    }
  }

  return receiptErrors;
}

/**
 * إرسال إشعارات الدفع لهواتف أولياء الأمور
 */
const sendPushNotification = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return { sent: 0, errors: [], receiptErrors: [] };

  const cleanTokens = [...new Set(tokens.filter((token) => Expo.isExpoPushToken(token)))];
  if (cleanTokens.length === 0) {
    console.log('⚠️ لا توجد رموز إشعارات إكسبو صالحة لإرسالها.');
    return { sent: 0, errors: ['no_valid_tokens'], receiptErrors: [] };
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
  const tokenOrder = [];

  for (const chunk of chunks) {
    chunk.forEach((msg) => tokenOrder.push(msg.to));
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
    const token = tokenOrder[i];

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
  const receiptErrors = await checkReceipts(tickets, tokenOrder);

  if (sent > 0 && receiptErrors.length === 0) {
    console.log(`✅ تم إرسال ${sent} إشعار/إشعارات بنجاح`);
  }

  return { sent, errors, receiptErrors };
};

module.exports = { sendPushNotification };
