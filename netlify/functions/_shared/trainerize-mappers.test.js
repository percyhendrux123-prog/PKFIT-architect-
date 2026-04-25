// Pure-function tests for the Trainerize mappers. Vitest-compatible.
//
// pkfit-app does not have Vitest installed yet (Issue #16 will land it).
// These tests are written against the standard Vitest API so they run as soon
// as the framework arrives. Until then the file documents the expected
// behaviour and protects future refactors.

import { describe, it, expect } from 'vitest';
import {
  parseSchemaVersion,
  isSchemaCompatible,
  contentHash,
  mapProfileFields,
  mapProgramRow,
  mapSessionRow,
  mapCheckInRow,
  checkInDedupKey,
  mapMealRow,
  resolveAdherence,
  buildPhotoPath,
  decodePhotoBase64,
  mapMessageRow,
  messageDedupKey,
  extractTrainerizeIdFromJsonbWrap,
  PHOTOS_BUCKET,
  SUPPORTED_SCHEMA_MAJOR,
} from './trainerize-mappers.js';

describe('parseSchemaVersion / isSchemaCompatible', () => {
  it('parses semver triples', () => {
    expect(parseSchemaVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('rejects non-semver', () => {
    expect(parseSchemaVersion('1.2')).toBeNull();
    expect(parseSchemaVersion('latest')).toBeNull();
    expect(parseSchemaVersion(undefined)).toBeNull();
  });

  it('accepts current major, rejects others', () => {
    expect(SUPPORTED_SCHEMA_MAJOR).toBe(1);
    expect(isSchemaCompatible('1.0.0')).toBe(true);
    expect(isSchemaCompatible('1.99.0')).toBe(true);
    expect(isSchemaCompatible('2.0.0')).toBe(false);
    expect(isSchemaCompatible('0.9.0')).toBe(false);
  });
});

describe('contentHash', () => {
  it('is deterministic and order-sensitive', () => {
    expect(contentHash('a', 'b')).toBe(contentHash('a', 'b'));
    expect(contentHash('a', 'b')).not.toBe(contentHash('b', 'a'));
  });
  it('treats null and undefined as empty string', () => {
    expect(contentHash(null, undefined)).toBe(contentHash('', ''));
  });
});

describe('mapProfileFields', () => {
  it('maps the shipping fields, drops anything not on the schema', () => {
    const out = mapProfileFields({
      trainerize_id: 'tz_x',
      email: 'a@b.test',
      name: 'Alice',
      joined_at: '2026-01-15T00:00:00Z',
      plan_label: 'Performance Standard',
      weight_unit: 'lbs',
      starting_height_cm: 180,
    });
    expect(out).toEqual({
      email: 'a@b.test',
      name: 'Alice',
      start_date: '2026-01-15',
      plan: 'Performance Standard',
      units: 'imperial',
    });
  });

  it('falls back to metric when weight_unit is "kg"', () => {
    expect(mapProfileFields({ weight_unit: 'kg' }).units).toBe('metric');
  });

  it('omits fields when the source key is absent', () => {
    expect(mapProfileFields({ email: 'a@b.test' })).toEqual({ email: 'a@b.test' });
  });
});

describe('mapProgramRow', () => {
  it('embeds trainerize_id in exercises._meta', () => {
    const row = mapProgramRow('client-uuid', {
      trainerize_id: 'tz_program_1',
      week_number: 2,
      title: 'Week 2',
      status: 'active',
      schedule: { days: ['mon'] },
      exercises: [{ name: 'Back Squat' }],
    });
    expect(row.exercises._meta).toEqual({ trainerize_id: 'tz_program_1', source: 'trainerize' });
    expect(row.exercises.items).toEqual([{ name: 'Back Squat' }]);
    expect(row.schedule.title).toBe('Week 2');
    expect(row.client_id).toBe('client-uuid');
    expect(row.status).toBe('active');
    expect(row.week_number).toBe(2);
  });

  it('coerces unknown status to archived', () => {
    expect(mapProgramRow('c', { trainerize_id: 'x', status: 'wat' }).status).toBe('archived');
  });

  it('defaults week_number to 1', () => {
    expect(mapProgramRow('c', { trainerize_id: 'x' }).week_number).toBe(1);
  });
});

describe('mapSessionRow', () => {
  it('resolves trainerize_program_id via the program map', () => {
    const map = new Map([['tz_program_1', 'supabase-program-uuid']]);
    const row = mapSessionRow('client-uuid', {
      trainerize_id: 'tz_session_1',
      trainerize_program_id: 'tz_program_1',
      performed_at: '2026-01-19T17:08:00Z',
      duration_min: 62,
      rpe_avg: 7.5,
      notes: 'felt strong',
      exercises: [{ name: 'Back Squat' }],
    }, map);
    expect(row.program_id).toBe('supabase-program-uuid');
    expect(row.exercises._meta.trainerize_id).toBe('tz_session_1');
  });

  it('leaves program_id null when unmapped', () => {
    const row = mapSessionRow('c', {
      trainerize_id: 'tz_s',
      trainerize_program_id: 'tz_unknown',
      performed_at: '2026-01-19T17:08:00Z',
      exercises: [],
    }, new Map());
    expect(row.program_id).toBeNull();
  });
});

describe('mapCheckInRow / checkInDedupKey', () => {
  it('maps weight_kg → weight and body_fat_pct → body_fat', () => {
    const row = mapCheckInRow('c', { date: '2026-01-19', weight_kg: 85.7, body_fat_pct: 18.4, notes: 'ok' });
    expect(row).toEqual({ client_id: 'c', date: '2026-01-19', weight: 85.7, body_fat: 18.4, notes: 'ok' });
  });

  it('produces a stable per-client-per-date dedup key', () => {
    const a = checkInDedupKey('c', { date: '2026-01-19' });
    const b = checkInDedupKey('c', { date: '2026-01-19' });
    expect(a).toBe(b);
    expect(checkInDedupKey('c', { date: '2026-01-19' })).not.toBe(checkInDedupKey('c', { date: '2026-01-26' }));
  });
});

describe('mapMealRow + resolveAdherence', () => {
  it('wraps items with _meta and preserves macros', () => {
    const row = mapMealRow('c', {
      trainerize_id: 'tz_meal_1',
      date: '2026-01-19',
      meal_type: 'lunch',
      items: [{ name: 'Rice' }],
      macros: { kcal: 600 },
    });
    expect(row.items._meta.trainerize_id).toBe('tz_meal_1');
    expect(row.items.items).toEqual([{ name: 'Rice' }]);
    expect(row.macros).toEqual({ kcal: 600 });
  });

  it('resolveAdherence returns ok for matched meal', () => {
    const map = new Map([['tz_meal_1', 'supabase-meal-uuid']]);
    const r = resolveAdherence({ trainerize_meal_id: 'tz_meal_1', eaten: true, eaten_at: '2026-01-19T13:05:00Z' }, map);
    expect(r.ok).toBe(true);
    expect(r.supabase_meal_id).toBe('supabase-meal-uuid');
    expect(r.update.eaten).toBe(true);
    expect(r.update.eaten_at).toBe('2026-01-19T13:05:00Z');
  });

  it('resolveAdherence returns reason for orphan trainerize_meal_id', () => {
    const r = resolveAdherence({ trainerize_meal_id: 'tz_orphan' }, new Map());
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no matching meal/);
  });
});

describe('buildPhotoPath / decodePhotoBase64', () => {
  it('builds a deterministic path keyed on client and trainerize_id', () => {
    const p = buildPhotoPath('client-uuid', {
      trainerize_id: 'tz_photo_22001',
      mime_type: 'image/jpeg',
      captured_at: '2026-01-19T07:30:00Z',
    });
    expect(p).toBe('client-uuid/checkin-2026-01-19T07-30-00.000Z-tz_photo_22001.jpg');
    // Path is deterministic on the same input — that's the upsert key.
    expect(buildPhotoPath('client-uuid', {
      trainerize_id: 'tz_photo_22001',
      mime_type: 'image/jpeg',
      captured_at: '2026-01-19T07:30:00Z',
    })).toBe(p);
  });

  it('handles png mime', () => {
    expect(buildPhotoPath('c', { trainerize_id: 'tz_p', mime_type: 'image/png', captured_at: '2026-01-19T07:30:00Z' })).toMatch(/\.png$/);
  });

  it('decodes a tiny base64 PNG into a buffer', () => {
    const r = decodePhotoBase64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
    expect(r.ok).toBe(true);
    expect(r.buffer.length).toBeGreaterThan(0);
  });

  it('rejects empty or non-base64 input', () => {
    expect(decodePhotoBase64('').ok).toBe(false);
    expect(decodePhotoBase64(null).ok).toBe(false);
  });
});

describe('mapMessageRow / messageDedupKey', () => {
  it('routes from_client to client author, from_coach to coach author', () => {
    const inbound = mapMessageRow('thread', 'c', 'coach', {
      direction: 'from_client', content: 'hi', sent_at: '2026-01-15T10:00:00Z',
    });
    expect(inbound.author_id).toBe('c');
    expect(inbound.read_by_client).toBe(true);
    expect(inbound.read_by_coach).toBe(true);

    const outbound = mapMessageRow('thread', 'c', 'coach', {
      direction: 'from_coach', content: 'hello', sent_at: '2026-01-15T10:00:00Z',
    });
    expect(outbound.author_id).toBe('coach');
  });

  it('content hash is stable across runs and changes with content or timestamp', () => {
    const m = { content: 'hi', sent_at: '2026-01-15T10:00:00Z' };
    expect(messageDedupKey('t1', m)).toBe(messageDedupKey('t1', m));
    expect(messageDedupKey('t1', m)).not.toBe(messageDedupKey('t1', { ...m, content: 'hi2' }));
    expect(messageDedupKey('t1', m)).not.toBe(messageDedupKey('t1', { ...m, sent_at: '2026-01-15T10:00:01Z' }));
    expect(messageDedupKey('t1', m)).not.toBe(messageDedupKey('t2', m));
  });
});

describe('extractTrainerizeIdFromJsonbWrap', () => {
  it('reads from _meta.trainerize_id', () => {
    expect(extractTrainerizeIdFromJsonbWrap({ _meta: { trainerize_id: 'tz_x' }, items: [] })).toBe('tz_x');
  });
  it('returns null on missing or malformed wrappers', () => {
    expect(extractTrainerizeIdFromJsonbWrap(null)).toBeNull();
    expect(extractTrainerizeIdFromJsonbWrap({})).toBeNull();
    expect(extractTrainerizeIdFromJsonbWrap([{ legacy: true }])).toBeNull();
  });
});

describe('PHOTOS_BUCKET', () => {
  it('points at the existing baseline-photos bucket per migration 0008', () => {
    expect(PHOTOS_BUCKET).toBe('baseline-photos');
  });
});
