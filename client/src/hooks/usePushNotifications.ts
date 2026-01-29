/**
 * usePushNotifications Hook
 * إدارة إشعارات Push للمتصفح
 */

import { useState, useEffect, useCallback } from 'react';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}

interface UsePushNotificationsReturn {
  permission: PushPermissionState;
  isSupported: boolean;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  showNotification: (options: PushNotificationOptions) => Promise<boolean>;
  checkPermission: () => PushPermissionState;
}

const checkBrowserSupport = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw-notifications.js', { scope: '/' });
    console.log('[Push] Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    return null;
  }
};

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PushPermissionState>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const isSupported = checkBrowserSupport();

  const checkPermission = useCallback((): PushPermissionState => {
    if (!isSupported) return 'unsupported';
    return Notification.permission as PushPermissionState;
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PushPermissionState);
    registerServiceWorker().then((registration) => {
      if (registration) setSwRegistration(registration);
    });
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('المتصفح لا يدعم الإشعارات');
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      setPermission('denied');
      setError('تم رفض إذن الإشعارات. يرجى تفعيلها من إعدادات المتصفح.');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermissionState);

      if (result === 'granted') {
        if (!swRegistration) {
          const registration = await registerServiceWorker();
          setSwRegistration(registration);
        }
        return true;
      } else if (result === 'denied') {
        setError('تم رفض إذن الإشعارات');
        return false;
      }
      return false;
    } catch (err) {
      console.error('[Push] Error requesting permission:', err);
      setError('حدث خطأ أثناء طلب إذن الإشعارات');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, swRegistration]);

  const showNotification = useCallback(async (options: PushNotificationOptions): Promise<boolean> => {
    if (!isSupported) {
      console.warn('[Push] Notifications not supported');
      return false;
    }

    if (Notification.permission !== 'granted') {
      console.warn('[Push] Notification permission not granted');
      return false;
    }

    try {
      if (swRegistration) {
        const notificationOptions: NotificationOptions = {
          body: options.body,
          icon: options.icon || '/logo.png',
          badge: options.badge || '/logo.png',
          tag: options.tag || 'notification',
          requireInteraction: options.requireInteraction || false,
          data: options.data,
          dir: 'rtl',
          lang: 'ar'
        };
        await swRegistration.showNotification(options.title, notificationOptions);
        return true;
      }

      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/logo.png',
        badge: options.badge || '/logo.png',
        tag: options.tag || 'notification',
        requireInteraction: options.requireInteraction || false,
        data: options.data,
        dir: 'rtl',
        lang: 'ar'
      });

      notification.onclick = () => {
        window.focus();
        if (options.data?.url) {
          window.location.href = options.data.url as string;
        }
        notification.close();
      };

      return true;
    } catch (err) {
      console.error('[Push] Error showing notification:', err);
      return false;
    }
  }, [isSupported, swRegistration]);

  return {
    permission,
    isSupported,
    isLoading,
    error,
    requestPermission,
    showNotification,
    checkPermission
  };
}

export default usePushNotifications;
