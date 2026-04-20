import { supabase } from './supabaseClient';

async function authHeader() {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function callFunction(name, body) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  };
  const res = await fetch(`/.netlify/functions/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  if (!res.ok) {
    const message = payload?.error || `Function ${name} failed (${res.status})`;
    throw new Error(message);
  }
  return payload;
}

export const claude = {
  generateWorkout: (input) => callFunction('generate-workout', input),
  generateMealPlan: (input) => callFunction('generate-meal-plan', input),
  assistant: (input) => callFunction('client-assistant', input),
};

export const billing = {
  createCheckout: (input) => callFunction('create-checkout-session', input),
  createPortal: (input) => callFunction('create-portal-session', input),
};
