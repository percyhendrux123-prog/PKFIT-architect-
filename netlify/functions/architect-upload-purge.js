// architect-upload-purge — daily scheduled function.
//
// Schedule: see netlify.toml ([functions."architect-upload-purge"] schedule).
// 02:00 UTC daily — offset from axiom-overseer (13:00) and migration-recovery
// (14:00) so the crons don't all burst in one minute.
//
// Action:
//   1. Select expired rows from architect_upload (expires_at < now()).
//   2. Delete the bucket objects.
//   3. Delete the rows.
//
// Idempotent: a failed bucket delete still drops the row, and the next run
// would notice nothing to do. Conversely, an orphan row whose storage object
// already died gets harmlessly attempted then removed.

import { getAdminClient } from './_shared/supabase-admin.js';

const BUCKET = 'architect-uploads';
const BATCH = 200;

export default async () => {
  const admin = getAdminClient();
  const nowIso = new Date().toISOString();

  const { data: expired, error: selectErr } = await admin
    .from('architect_upload')
    .select('id, storage_path')
    .lt('expires_at', nowIso)
    .limit(BATCH);
  if (selectErr) {
    return new Response(
      JSON.stringify({ error: 'select_failed', message: selectErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!expired || expired.length === 0) {
    return new Response(JSON.stringify({ purged: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const paths = expired.map((r) => r.storage_path).filter(Boolean);
  const ids = expired.map((r) => r.id);

  let storageError = null;
  if (paths.length > 0) {
    const { error: removeErr } = await admin.storage.from(BUCKET).remove(paths);
    if (removeErr) storageError = removeErr.message;
  }

  const { error: deleteErr } = await admin.from('architect_upload').delete().in('id', ids);
  if (deleteErr) {
    return new Response(
      JSON.stringify({
        error: 'delete_failed',
        message: deleteErr.message,
        storage_error: storageError,
        candidate_count: expired.length,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      purged: expired.length,
      storage_error: storageError,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
