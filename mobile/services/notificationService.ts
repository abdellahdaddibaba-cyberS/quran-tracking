import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { authAPI } from './api';

// تهيئة معالج الإشعارات عند تشغيل التطبيق في الواجهة (Foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * طلب صلاحية الإشعارات والحصول على رمز دفع إكسبو (Expo Push Token)
 */
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('⚠️ لم يتم منح صلاحية إشعارات الهاتف');
      return null;
    }
    
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
        
      token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;
      console.log('✅ رمز إشعارات إكسبو:', token);
    } catch (e) {
      console.error('❌ خطأ أثناء الحصول على رمز إشعارات إكسبو:', e);
    }
  } else {
    console.log('⚠️ الإشعارات لا تعمل على المحاكيات، يرجى استخدام جهاز حقيقي');
  }

  return token;
}

/**
 * جلب رمز إشعارات الهاتف وإرساله للخادم لحفظه لولي الأمر
 */
export async function setupNotifications() {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      await authAPI.savePushToken(token);
      console.log('✅ تم حفظ رمز الإشعارات في قاعدة البيانات بنجاح');
    }
  } catch (error) {
    console.error('❌ فشل إرسال رمز الإشعارات للسيرفر:', error);
  }
}
