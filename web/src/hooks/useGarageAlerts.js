import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export function useGarageAlerts(alertMessage, onRespond) {
  useEffect(() => {
    if (!alertMessage || alertMessage.kind !== 'garage_prompt') return;
    if (!Capacitor.isNativePlatform()) return; // web handles it via the in-app modal

    LocalNotifications.schedule({
      notifications: [{
        id: alertMessage.alert_id,
        title: 'SmartNest',
        body: alertMessage.text,
        actionTypeId: 'GARAGE_PROMPT',
        extra: { device_id: alertMessage.device_id },
      }],
    });
  }, [alertMessage]);

  useEffect(() => {
    LocalNotifications.registerActionTypes({
      types: [{
        id: 'GARAGE_PROMPT',
        actions: [
          { id: 'yes', title: 'Yes, open' },
          { id: 'no', title: 'No' },
        ],
      }],
    });
    const listener = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const deviceId = action.notification.extra?.device_id;
      onRespond(deviceId, action.actionId === 'yes');
    });
    return () => listener.remove();
  }, [onRespond]);
}