import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * يتحقق من تحديثات EAS (OTA) عند فتح التطبيق
 */
export function useAppUpdates() {
  useEffect(() => {
    if (Platform.OS === 'web' || __DEV__ || !Updates.isEnabled) return;

    async function checkForUpdates() {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          Alert.alert(
            'تحديث جديد 🚀',
            'يوجد تحديث جديد للتطبيق، سيتم تنزيله وإعادة تشغيل التطبيق لتطبيقه الآن.',
            [{ text: 'موافق', onPress: async () => {
              try {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              } catch (err) {
                console.warn('Failed to fetch/apply update:', err);
              }
            }}]
          );
        }
      } catch (error) {
        console.warn('OTA update check failed:', error);
      }
    }

    checkForUpdates();
  }, []);
}
