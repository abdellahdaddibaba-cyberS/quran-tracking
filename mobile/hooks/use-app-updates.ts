import { useEffect } from 'react';
import * as Updates from 'expo-updates';

/**
 * يتحقق من تحديثات EAS (OTA) عند فتح التطبيق — بدون إعادة بناء كاملة
 */
export function useAppUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    async function checkForUpdates() {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.warn('OTA update check failed:', error);
      }
    }

    checkForUpdates();
  }, []);
}
