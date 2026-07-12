import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import client from '../api/client';

export async function setupPushNotifications() {
  if (!Capacitor.isNativePlatform()) return; // push only works in the native app, not the browser

  const permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive !== 'granted') {
    const requested = await PushNotifications.requestPermissions();
    if (requested.receive !== 'granted') {
      console.warn('Push notification permission denied');
      return;
    }
  }

  await PushNotifications.register();

  // Fired once Firebase successfully issues a device token
  PushNotifications.addListener('registration', async (token) => {
    try {
      await client.post('/api/devices/register-push-token/', { fcm_token: token.value });
      console.log('Push token registered with backend');
    } catch (err) {
      console.error('Failed to register push token:', err);
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('Push registration error:', err);
  });

  // Fired when a notification is tapped or received while app is open
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received in foreground:', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('Push tapped:', action.notification);
  });
}