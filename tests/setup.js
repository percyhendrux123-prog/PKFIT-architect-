// Global test setup. Stubs env vars the netlify functions read at module
// load time so importing them does not throw. Individual tests still
// override these (or delete them) to exercise specific branches.

import { vi, beforeEach, afterEach } from 'vitest';

const BASELINE_ENV = {
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  STRIPE_SECRET_KEY: 'sk_test_mock',
  STRIPE_WEBHOOK_SECRET: 'whsec_mock',
  ANTHROPIC_API_KEY: 'sk-ant-mock',
  STRIPE_PRICE_PERFORMANCE_MONTHLY: 'price_perf_m',
  STRIPE_PRICE_PERFORMANCE_ANNUAL: 'price_perf_a',
  STRIPE_PRICE_IDENTITY_MONTHLY: 'price_id_m',
  STRIPE_PRICE_IDENTITY_ANNUAL: 'price_id_a',
  STRIPE_PRICE_FULL_MONTHLY: 'price_full_m',
  STRIPE_PRICE_FULL_ANNUAL: 'price_full_a',
  STRIPE_PRICE_PREMIUM_MONTHLY: 'price_prem_m',
  STRIPE_PRICE_PREMIUM_ANNUAL: 'price_prem_a',
};

beforeEach(() => {
  for (const [k, v] of Object.entries(BASELINE_ENV)) {
    process.env[k] = v;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});
