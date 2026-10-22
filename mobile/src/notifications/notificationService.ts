import { isRunningInExpoGo } from 'expo';
import { api } from '../api/client';
import { router } from 'expo-router';

type NotificationsModule = typeof import('expo-notifications');

/**
 * expo-notifications is loaded lazily and defensively: if its native side is missing in the
 * current binary (e.g. a module Expo Go doesn't ship), notifications are disabled instead of
 * crashing every screen that imports this file. See also metro.config.js.
 */
let notificationsModule: NotificationsModule | null | undefined;

function getNotifications(): NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;
  try {
    const mod: NotificationsModule = require('expo-notifications');
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationsModule = mod;
  } catch (err) {
    console.warn('[notifications] unavailable in this build, disabling:', err);
    notificationsModule = null;
  }
  return notificationsModule;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('[notifications] requestPermission error:', err);
    return false;
  }
}

/** Check without prompting — the onboarding pre-prompt is the only place we ask. */
async function hasNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    return (await Notifications.getPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}

export async function registerPushToken(): Promise<string | null> {
  // Remote push doesn't exist in Expo Go on Android (SDK 53+) — local notifications still work.
  if (isRunningInExpoGo()) return null;
  const Notifications = getNotifications();
  if (!Notifications) return null;
  try {
    const isGranted = await hasNotificationPermission();
    if (!isGranted) return null;

    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    if (tokenData?.data) {
      await api.notifications.register(tokenData.data).catch((e) => {
        console.log('[notifications] token registration on backend skipped or failed:', e?.message);
      });
      return tokenData.data;
    }
  } catch (err) {
    console.log('[notifications] Push token registration skipped:', err);
  }
  return null;
}

/** On sign-out: this phone shouldn't keep reminding the person who just left. */
export async function cancelScheduledReminders(): Promise<void> {
  try {
    await getNotifications()?.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('[notifications] cancel failed:', err);
  }
}

export async function syncNotificationSchedule(count: number): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    const isGranted = await hasNotificationPermission();
    if (!isGranted) return;

    const res = await api.notifications.schedule(count);

    // Cancel all previous scheduled notifications (also when the user turned them down to 0)
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!res.notifications || res.notifications.length === 0) return;

    const now = new Date();

    for (const item of res.notifications) {
      const scheduledTime = new Date();
      scheduledTime.setHours(item.hour, item.minute, 0, 0);

      // Only schedule if time is in the future today
      if (scheduledTime.getTime() > now.getTime()) {
        const secondsUntil = Math.max(1, Math.floor((scheduledTime.getTime() - now.getTime()) / 1000));
        await Notifications.scheduleNotificationAsync({
          content: {
            title: item.title,
            body: item.body,
            data: { screen: 'capture', slot: item.slot },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: secondsUntil,
            repeats: false,
          },
        });
      }
    }
  } catch (err) {
    console.warn('[notifications] syncNotificationSchedule error:', err);
  }
}

export async function triggerTestNotification(): Promise<{ title: string; body: string }> {
  await requestNotificationPermission();
  const res = await api.notifications.test();
  const notif = res.notification;

  // Immediately present as a local notification
  const Notifications = getNotifications();
  if (Notifications) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notif.title,
        body: notif.body,
        data: { screen: 'capture' },
      },
      trigger: null, // triggers immediately
    });
  }

  return notif;
}

export function setupNotificationResponseListener(): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.screen === 'capture') {
      try {
        router.push('/capture' as any);
      } catch (err) {
        console.warn('[notifications] Navigation error on response:', err);
      }
    }
  });

  return () => {
    subscription.remove();
  };
}
