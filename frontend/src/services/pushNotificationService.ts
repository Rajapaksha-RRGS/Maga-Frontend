/**
 * pushNotificationService.ts
 *
 * Firebase Cloud Messaging (FCM) push notification handling via @capacitor/push-notifications.
 * Allows instant background & closed-app push alerts directly to the device.
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';
import { playNotificationChime } from './localNotificationService';

const FCM_TOKEN_KEY = 'maga_fcm_token';

let isPushInitialized = false;

export interface PushNotificationCallbacks {
  onToken?: (token: string) => void;
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationActionPerformed?: (action: ActionPerformed) => void;
}

/**
 * Initializes Firebase Push Notifications, requests OS permissions,
 * and registers the device with Google FCM to obtain the device token.
 */
export async function initPushNotifications(callbacks?: PushNotificationCallbacks): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    console.info('Push notifications are supported on native Android/iOS platforms.');
    return null;
  }

  try {
    // 1. Check existing permission status
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('Push notification permission was not granted by user:', permStatus.receive);
      return null;
    }

    // 2. Setup listeners once
    if (!isPushInitialized) {
      // Create high-importance push channel for Android 8+
      try {
        await PushNotifications.createChannel({
          id: 'maga_site_alerts',
          name: 'MäGA Site Tasks & Alerts',
          description: 'Instant site push alerts and supervisor tasks',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#2563EB',
        });
      } catch (channelErr) {
        // Fallback if already exists or unsupported
      }

      // Registration success: FCM token delivered
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('✅ FCM Registration successful! Token:', token.value);
        try {
          localStorage.setItem(FCM_TOKEN_KEY, token.value);
        } catch {}

        if (callbacks?.onToken) {
          callbacks.onToken(token.value);
        }
      });

      // Registration error
      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('❌ FCM Registration failed:', error);
      });

      // Push received while app is running in foreground
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('🔔 Foreground Push Notification received:', notification);
        playNotificationChime();

        if (callbacks?.onNotificationReceived) {
          callbacks.onNotificationReceived(notification);
        }
      });

      // Action performed: User clicked the notification in system tray
      PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('👆 Push Notification tapped by user:', action);

        if (callbacks?.onNotificationActionPerformed) {
          callbacks.onNotificationActionPerformed(action);
        }
      });

      isPushInitialized = true;
    }

    // 3. Register with Google FCM gateway
    await PushNotifications.register();

    return localStorage.getItem(FCM_TOKEN_KEY);
  } catch (err) {
    console.error('Failed to initialize push notifications:', err);
    return null;
  }
}

/**
 * Retrieves the stored FCM Device Token
 */
export function getStoredFcmToken(): string | null {
  try {
    return localStorage.getItem(FCM_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Unregisters / removes push listeners (e.g. on logout)
 */
export async function removePushListeners(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await PushNotifications.removeAllListeners();
    isPushInitialized = false;
  } catch (err) {
    console.warn('Error removing push listeners:', err);
  }
}
