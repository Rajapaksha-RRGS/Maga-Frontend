/**
 * localNotificationService.ts
 *
 * Handles native Android & iOS local notifications with sound and vibration
 * using @capacitor/local-notifications, with browser fallback and audio chime.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { CalendarEvent } from '../features/calendar/services/calendarEventService';

const CHANNEL_ID = 'maga_site_alerts';
const NOTIFIED_IDS_KEY = 'maga_notified_event_ids';

let isChannelCreated = false;

/**
 * Generates an audio notification chime using Web Audio API (works in both Web and Webview)
 */
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Two-tone pleasant chime (High-pitch modern ping: 587Hz D5 -> 880Hz A5)
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.35, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (err) {
    // Audio context may require user interaction first
  }
}

/**
 * Initialize notification channels and request permission
 */
export async function initializeNotifications(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }

  try {
    // 1. Request notification permissions from Android / iOS
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== 'granted') {
        return false;
      }
    }

    // 2. Setup High-Priority Android Notification Channel (with Sound & Vibration)
    if (!isChannelCreated) {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: 'MäGA Site Tasks & Alerts',
        description: 'Instant sound notifications for site supervisor events, tasks and reminders',
        importance: 5, // High Importance (Heads-up banner + Sound on Android 8+)
        visibility: 1, // Public (shows on lockscreen)
        vibration: true,
        lights: true,
        lightColor: '#2563EB',
      });
      isChannelCreated = true;
    }

    return true;
  } catch (err) {
    console.warn('Failed to initialize local notifications:', err);
    return false;
  }
}

/**
 * Gets the set of event IDs that have already triggered a notification
 */
function getNotifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

/**
 * Persists notified event IDs in localStorage
 */
function saveNotifiedIds(ids: Set<string>) {
  try {
    // Keep max 200 items to avoid storage bloat
    const arr = Array.from(ids).slice(-200);
    localStorage.setItem(NOTIFIED_IDS_KEY, JSON.stringify(arr));
  } catch {}
}

/**
 * Simple numeric hash for event IDs to satisfy Android int notification ID requirements
 */
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
}

/**
 * Compares incoming reminders/events and fires native Android notification + sound
 * for any brand-new events that haven't been notified yet.
 */
export async function notifyNewAdminEvents(
  events: CalendarEvent[],
  onNotificationTapped?: (event: CalendarEvent) => void
): Promise<number> {
  if (!events || events.length === 0) return 0;

  const notifiedIds = getNotifiedIds();
  const brandNewEvents = events.filter((e) => !notifiedIds.has(e.id));

  if (brandNewEvents.length === 0) return 0;

  // Mark them as notified immediately to avoid re-triggering
  brandNewEvents.forEach((e) => notifiedIds.add(e.id));
  saveNotifiedIds(notifiedIds);

  // Play audio chime
  playNotificationChime();

  // If on Native Capacitor (Android device)
  if (Capacitor.isNativePlatform()) {
    try {
      await initializeNotifications();

      const notifications = brandNewEvents.map((evt) => {
        const isUrgent = evt.priority === 'urgent';
        const isImportant = evt.priority === 'important';

        const prefix = isUrgent ? '🔥 URGENT: ' : isImportant ? '⚡ ' : '📢 ';
        const title = `${prefix}Site Notice: ${evt.title}`;
        const timeStr = evt.time ? ` [${evt.time}]` : '';
        const body = `${timeStr} ${evt.notes || evt.location || 'New event posted by site admin.'}`.trim();

        return {
          id: hashStringToInt(evt.id),
          title,
          body,
          channelId: CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 500) }, // Pop immediately
          sound: undefined, // Uses channel sound
          extra: {
            eventId: evt.id,
            priority: evt.priority,
          },
        };
      });

      await LocalNotifications.schedule({ notifications });

      // Listen for action/tap
      if (onNotificationTapped) {
        LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
          const matched = events.find(
            (e) => hashStringToInt(e.id) === notification.notification.id
          );
          if (matched) {
            onNotificationTapped(matched);
          }
        });
      }
    } catch (err) {
      console.warn('Native notification scheduling failed:', err);
    }
  }

  return brandNewEvents.length;
}
