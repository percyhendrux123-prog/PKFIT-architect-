import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';

// Hard-deletes the caller's auth user. All public.* rows referencing the user
// cascade via their FK `on delete cascade`. Storage objects under the user's
// prefixes are removed explicitly since storage.objects does not cascade from
// auth.users.

async function deleteStoragePrefix(admin, bucket, prefix) {
  const { data: files } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!files?.length) return;
  const paths = files.map((f) => `${prefix}/${f.name}`);
  await admin.storage.from(bucket).remove(paths);
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user } = await requireUser(event);
    const body = JSON.parse(event.body || '{}');
    if (body.confirm !== 'DELETE') {
      return jsonResponse(400, { error: 'Confirmation required. Send { "confirm": "DELETE" }.' });
    }

    const admin = getAdminClient();
    await Promise.all([
      deleteStoragePrefix(admin, 'baseline-photos', user.id),
      deleteStoragePrefix(admin, 'avatars', user.id),
      deleteStoragePrefix(admin, 'community-photos', user.id),
    ]);

    // admin.auth.admin.deleteUser cascades public.profiles → all child rows.
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return jsonResponse(500, { error: error.message });

    return jsonResponse(200, { deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
};
