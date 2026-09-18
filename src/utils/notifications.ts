import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { soundFx } from './audio';

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  type: 'task' | 'habit' | 'pomodoro' | 'sms';
  timestamp: string;
}

export interface NativeAlarmScheduleOptions {
  id: number;
  title: string;
  body: string;
  atDate: Date;
  type?: 'task' | 'habit' | 'pomodoro';
  sound?: string;
}

const ALARM_CHANNEL_ID = 'lifeplanner_system_alarms';
let isChannelCreated = false;

/**
 * Ensures high-priority notification channel is created for Android System Alarm Manager
 */
async function ensureNotificationChannel(): Promise<void> {
  if (isChannelCreated || !Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: ALARM_CHANNEL_ID,
      name: 'هشدارهای مهم لایف‌پلانر (LifePlanner Alarms)',
      description: 'کانال اختصاصی هشدارهای دقیق زمان‌بندی‌شده و آلارم‌های بومی اندروید',
      importance: 5, // High / Urgent importance
      visibility: 1, // Public on lockscreen
      sound: 'alarm.wav',
      vibration: true,
      lights: true,
      lightColor: '#3b82f6',
    });
    isChannelCreated = true;
  } catch (err) {
    console.warn('Could not create notification channel:', err);
  }
}

/**
 * Checks if running inside native Capacitor environment
 */
export function isNativeMobile(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isNotificationSupported(): boolean {
  if (isNativeMobile()) return true;
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function getNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (isNativeMobile()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return 'granted';
      if (status.display === 'denied') return 'denied';
      return 'default';
    } catch {
      return 'granted';
    }
  }

  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (isNativeMobile()) {
    try {
      await ensureNotificationChannel();
      const res = await LocalNotifications.requestPermissions();
      if (res.display === 'granted') return 'granted';
      if (res.display === 'denied') return 'denied';
      return 'default';
    } catch (e) {
      console.warn('Native permission request failed:', e);
      return 'granted';
    }
  }

  if (!isNotificationSupported()) return 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return Notification.permission;
  }
}

/**
 * Schedules an exact background alarm directly into the Android System Alarm Manager
 * using Capacitor Local Notifications with allowWhileIdle: true.
 * This guarantees the alarm rings even when the device is locked, the app is closed,
 * or after a device reboot.
 */
export async function scheduleSystemAlarm(options: NativeAlarmScheduleOptions): Promise<boolean> {
  const { id, title, body, atDate, type = 'task', sound = 'alarm.wav' } = options;

  // Validate that scheduled date is in future
  const now = new Date();
  if (atDate <= now) {
    // If it's already due or past, trigger immediately
    triggerNotificationAlert(title, body, type, true);
    return true;
  }

  if (isNativeMobile()) {
    try {
      await ensureNotificationChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.abs(id % 2147483647), // Valid Android 32-bit integer
            title,
            body,
            schedule: {
              at: atDate,
              allowWhileIdle: true, // Crucial for Android AlarmManager to bypass Doze mode!
            },
            sound,
            channelId: ALARM_CHANNEL_ID,
            actionTypeId: 'ALARM_ACTION',
            extra: {
              type,
              scheduledAt: atDate.toISOString(),
            },
          },
        ],
      });
      return true;
    } catch (err) {
      console.warn('Failed to schedule native Android alarm:', err);
    }
  }

  // Web Fallback: schedule timer if window is open
  const delayMs = atDate.getTime() - now.getTime();
  if (delayMs > 0 && delayMs < 2147483647) {
    setTimeout(() => {
      triggerNotificationAlert(title, body, type, true);
    }, delayMs);
  }

  return true;
}

/**
 * Cancel a scheduled native system alarm by ID
 */
export async function cancelSystemAlarm(id: number): Promise<void> {
  if (isNativeMobile()) {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: Math.abs(id % 2147483647) }],
      });
    } catch (err) {
      console.warn('Failed to cancel native alarm:', err);
    }
  }
}

/**
 * Trigger immediate notification & alert (Native or Web)
 */
export function triggerNotificationAlert(
  title: string,
  body: string,
  type: 'task' | 'habit' | 'pomodoro' | 'sms' = 'task',
  isAlarm: boolean = false
): void {
  // 1. Play audio chime/alarm
  if (isAlarm || type === 'pomodoro') {
    soundFx.playAlarm();
  } else {
    soundFx.playReminderChime();
  }

  // 2. Hardware vibration
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (isAlarm || type === 'pomodoro') {
        navigator.vibrate([300, 150, 300, 150, 500]);
      } else {
        navigator.vibrate([200, 100, 200]);
      }
    } catch {
      // Ignore vibration errors
    }
  }

  // 3. Native Capacitor Local Notification
  if (isNativeMobile()) {
    ensureNotificationChannel().then(() => {
      LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 1000000),
            title,
            body,
            schedule: { at: new Date(Date.now() + 100) },
            channelId: ALARM_CHANNEL_ID,
            sound: isAlarm ? 'alarm.wav' : undefined,
          },
        ],
      }).catch((err) => {
        console.warn('Native trigger notification failed:', err);
      });
    });
    return;
  }

  // 4. HTML5 Web Notification API Fallback
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(title, {
              body,
              icon: '/pwa-192x192.png',
              badge: '/icon.svg',
              tag: `lifeplanner-${type}-${Date.now()}`,
              requireInteraction: isAlarm,
              data: { url: '/' },
            });
          })
          .catch(() => {
            const notif = new Notification(title, {
              body,
              icon: '/pwa-192x192.png',
              tag: `lifeplanner-${type}-${Date.now()}`,
              requireInteraction: isAlarm,
            });
            notif.onclick = () => {
              window.focus();
              notif.close();
            };
          });
      } else {
        const notif = new Notification(title, {
          body,
          icon: '/pwa-192x192.png',
          tag: `lifeplanner-${type}-${Date.now()}`,
          requireInteraction: isAlarm,
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
    } catch (e) {
      console.warn('Web notification failed:', e);
    }
  }
}

export const notificationSystem = {
  isSupported: isNotificationSupported,
  getPermission: getNotificationPermission,
  requestPermission: requestNotificationPermission,
  scheduleAlarm: scheduleSystemAlarm,
  cancelAlarm: cancelSystemAlarm,
  triggerAlert: ({
    title,
    body,
    sound = 'chime',
    type = 'task',
  }: {
    title: string;
    body: string;
    sound?: 'alarm' | 'chime' | 'none';
    type?: 'task' | 'habit' | 'pomodoro' | 'sms';
  }) => {
    if (sound === 'alarm') {
      soundFx.playAlarm();
    } else if (sound === 'chime') {
      soundFx.playReminderChime();
    }
    triggerNotificationAlert(title, body, type, sound === 'alarm');
  },
};
