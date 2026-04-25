// Web Push subscription helpers.
//
// Flow:
//   1. ensurePushReady()      — feature-detects SW + Push, returns the registration.
//   2. requestNotifications() — prompts for Notification.permission.
//   3. subscribeToPush()      — subscribes via pushManager + posts to /api/push-subscribe.
//   4. unsubscribeFromPush()  — local unsubscribe + DELETE on the function.

import { supabase } from './supabaseClient';

export const PUSH_FN_URL = '/.netlify/functions/push-subscribe';

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function ensurePushReady() {
  if (!pushSupported()) throw new Error('Push not supported in this browser.');
  const reg = await navigator.serviceWorker.ready;
  return reg;
}

export async function requestNotifications() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export async function subscribeToPush() {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not set. See README for VAPID setup.');
  }
  const reg = await ensurePushReady();

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Not signed in.');

  const res = await fetch(PUSH_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Push subscribe failed (${res.status}): ${text}`);
  }
  return sub;
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;

  await sub.unsubscribe().catch(() => undefined);

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) return true;

  await fetch(PUSH_FN_URL, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined);

  return true;
}
