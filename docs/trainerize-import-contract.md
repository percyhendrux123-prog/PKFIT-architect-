# Trainerize Import Contract (v1.0.0)

> Schema for the JSON payload accepted by `POST /.netlify/functions/trainerize-import`.
> This is the contract Issue #19 (Apify Trainerize scraper) must produce.
> Reference fixture: `tests/fixtures/trainerize-sample.json`.

## Top-level shape

```json
{
  "_schema_version": "1.0.0",
  "_source": "trainerize-export",
  "_exported_at": "ISO-8601 UTC timestamp",
  "client":            { ... },
  "programs":          [ ... ],
  "workout_sessions":  [ ... ],
  "check_ins":         [ ... ],
  "meals":             [ ... ],
  "meal_adherence":    [ ... ],
  "progress_photos":   [ ... ],
  "messages":          [ ... ]
}
```

Every section is optional. A minimal valid payload is `{ "_schema_version": "1.0.0", "client": { ... } }`.

The HTTP body wraps this object as:

```json
{
  "trainerize_export": { ... },
  "trainerize_client_id": "tz_client_847211",
  "dry_run": false
}
```

`trainerize_client_id` is required and is matched against `trainerize_export.client.trainerize_id`. They must agree — this guards against payload-swap mistakes during a bulk migration. `dry_run: true` runs all mappers and dedup logic without writing to Supabase or Storage; the response shows what *would* have happened.

## `client` (object)

| Field                  | Required | Type    | Mapped to                                    |
|------------------------|----------|---------|----------------------------------------------|
| `trainerize_id`        | yes      | string  | embedded in `_meta` markers throughout       |
| `email`                | yes      | string  | `auth.users.email` (natural key for dedup)   |
| `name`                 | no       | string  | `profiles.name`                              |
| `joined_at`            | no       | ISO     | `profiles.start_date` (date portion)         |
| `plan_label`           | no       | string  | `profiles.plan` (free-text — not enforced)   |
| `weight_unit`          | no       | "lbs" \| "kg" | `profiles.units` ('imperial' if 'lbs', else 'metric') |
| `height_unit`          | no       | "in" \| "cm"  | informational only                            |
| `starting_weight_kg`   | no       | number  | seeds first `check_ins` row if no check-ins  |
| `starting_height_cm`   | no       | number  | informational only (no column today)         |

**Idempotency:** if `auth.users` already has a row with this email, we use that user; we do not create a duplicate. If not, we call `admin.auth.admin.createUser` with `email_confirm: true` and the trigger creates the `profiles` row, which we then update.

## `programs` (array of objects)

| Field                  | Required | Mapped to                                    |
|------------------------|----------|----------------------------------------------|
| `trainerize_id`        | yes      | embedded in `programs.exercises._meta.trainerize_id` |
| `week_number`          | no       | `programs.week_number` (default 1)           |
| `title`                | no       | folded into `programs.schedule.title`        |
| `status`               | no       | `programs.status` ('active' / 'archived' / 'draft') |
| `schedule`             | no       | `programs.schedule` (jsonb)                  |
| `exercises`            | yes      | wrapped: `{ _meta: { trainerize_id }, items: [...] }` and stored on `programs.exercises` |

## `workout_sessions` (array of objects)

| Field                     | Required | Mapped to                                    |
|---------------------------|----------|----------------------------------------------|
| `trainerize_id`           | yes      | embedded in `workout_sessions.exercises._meta.trainerize_id` |
| `trainerize_program_id`   | no       | resolved to local `program_id` after programs import |
| `performed_at`            | yes      | `workout_sessions.performed_at` (timestamptz) |
| `duration_min`            | no       | `workout_sessions.duration_min`              |
| `rpe_avg`                 | no       | `workout_sessions.rpe_avg`                   |
| `notes`                   | no       | `workout_sessions.notes`                     |
| `exercises`               | yes      | wrapped: `{ _meta: { trainerize_id }, items: [...] }` |

## `check_ins` (array of objects)

| Field             | Required | Mapped to                              |
|-------------------|----------|----------------------------------------|
| `trainerize_id`   | yes      | content-hash dedup key (no jsonb to embed in) |
| `date`            | yes      | `check_ins.date`                       |
| `weight_kg`       | no       | `check_ins.weight`                     |
| `body_fat_pct`    | no       | `check_ins.body_fat`                   |
| `notes`           | no       | `check_ins.notes`                      |

**Dedup:** since `check_ins` has no jsonb column, we use natural key `(client_id, date)`. If a row already exists we skip + warn rather than overwrite.

## `meals` (array of objects)

| Field             | Required | Mapped to                              |
|-------------------|----------|----------------------------------------|
| `trainerize_id`   | yes      | embedded in `meals.items._meta.trainerize_id` |
| `date`            | no       | `meals.date`                           |
| `day`             | no       | `meals.day` ('mon', 'tue', …)          |
| `meal_type`       | no       | `meals.meal_type`                      |
| `items`           | yes      | wrapped jsonb with `_meta`             |
| `macros`          | no       | `meals.macros`                         |

## `meal_adherence` (array of objects)

| Field                      | Required | Effect                                                    |
|----------------------------|----------|-----------------------------------------------------------|
| `trainerize_meal_id`       | yes      | matches `meals.items._meta.trainerize_id` already imported |
| `eaten`                    | yes      | toggles `meals.eaten`                                      |
| `eaten_at`                 | no       | `meals.eaten_at`                                           |

**Skip-and-warn:** if `trainerize_meal_id` does not match a previously imported meal, the adherence row is skipped and added to `warnings`. We do not invent a meal row — that would be data fabrication.

## `progress_photos` (array of objects)

| Field            | Required | Effect                                                   |
|------------------|----------|----------------------------------------------------------|
| `trainerize_id`  | yes      | embedded in storage filename                             |
| `checkin_date`   | yes      | matches a `check_ins` row by `(client_id, date)`         |
| `captured_at`    | no       | informational (filename also embeds timestamp)           |
| `mime_type`      | yes      | "image/jpeg" or "image/png"                              |
| `data_base64`    | yes      | base64-encoded image bytes                               |

**Storage:** uploaded to existing `baseline-photos` bucket at path `<client_id>/checkin-<iso-timestamp>-<trainerize_id>.<ext>`. The corresponding `check_ins.photo_path` is set to that path. We reuse the existing bucket because there is no `checkin_photos` bucket on `app-main` today (the schema folds check-in and baseline photos into one bucket per migration `0008_checkin_photos.sql`).

**Idempotency:** Storage upload uses upsert with the deterministic path; re-uploading the same file is a no-op.

## `messages` (array of objects)

| Field            | Required | Effect                                                   |
|------------------|----------|----------------------------------------------------------|
| `trainerize_id`  | yes      | content-hash dedup key                                   |
| `sent_at`        | yes      | `dm_messages.created_at` (preserved from source)         |
| `direction`      | yes      | `"from_client"` → `author_id = client.id`; `"from_coach"` → `author_id = <authed-coach-id>` |
| `content`        | yes      | `dm_messages.content`                                    |

A single `dm_threads` row is upserted per client (unique on `client_id`). Messages are inserted into that thread.

**Dedup:** content-hash on `(thread_id, created_at_iso, content)`. If a row with the same hash already exists, skip.

## Response shape

```json
{
  "status": "ok" | "partial" | "failed",
  "client_id_supabase": "uuid",
  "imported": {
    "programs": 2,
    "sessions": 2,
    "checkins": 2,
    "meals": 2,
    "meal_adherence": 2,
    "photos": 1,
    "messages": 3
  },
  "skipped": {
    "programs":       [{ "trainerize_id": "...", "reason": "already imported (matching _meta.trainerize_id)" }],
    "sessions":       [...],
    "checkins":       [...],
    "meals":          [...],
    "meal_adherence": [{ "trainerize_meal_id": "tz_meal_77412_orphan", "reason": "no matching meal in import or in db" }],
    "photos":         [...],
    "messages":       [...]
  },
  "warnings": [
    "client.starting_height_cm: no column on profiles — value retained in raw payload only"
  ]
}
```

`status`:
- `ok` — every section either imported or fully skipped as already-present.
- `partial` — at least one row landed in `skipped` for a reason other than already-imported (e.g., missing required field, orphan reference).
- `failed` — the import aborted before completing client setup, or any database error fired. Body includes `error`.

## Schema gaps flagged for future migration

These are the points where Trainerize concepts do not map cleanly to the current schema. Documented for the reviewer; no migration is shipped in this PR.

1. **`profiles` lacks `trainerize_client_id`.** We use email as the natural key today. A future migration could add `profiles.trainerize_client_id text unique` for explicit dedup and audit.
2. **`baseline-photos` bucket holds both baseline and check-in photos.** Issue #13 referenced a `checkin_photos` bucket; one does not exist. A future migration could split them or rename the bucket.
3. **No per-row `external_id` columns** on `programs`, `workout_sessions`, `check_ins`, `meals`, `dm_messages`. We embed in jsonb where possible and use content hashes elsewhere. Adding explicit `external_id text` columns with unique indexes would simplify dedup and audit.

## Versioning

Bump `_schema_version` on any breaking change. The importer reads this and rejects payloads with major-version mismatches.
