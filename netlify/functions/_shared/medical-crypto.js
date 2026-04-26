import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

// AES-256-GCM at-rest encryption for the profiles.medical_encrypted column.
// Keyed by MEDICAL_ENC_SECRET (server env, never in the bundle). Layout:
//   IV (12 bytes) || authTag (16 bytes) || ciphertext
//
// Threat model: Supabase data leak / accidental dump must not expose
// medical PII. The secret lives in Netlify env, which is a separate trust
// boundary. Decryption happens only inside Netlify Functions and only for
// the authenticated owner of the row.

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey() {
  const secret = process.env.MEDICAL_ENC_SECRET;
  if (!secret) throw new Error('MEDICAL_ENC_SECRET missing');
  return createHash('sha256').update(secret).digest();
}

export function encryptMedical(plaintextJson) {
  const data = JSON.stringify(plaintextJson ?? {});
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decryptMedical(stored) {
  if (!stored) return null;
  const buf = Buffer.isBuffer(stored) ? stored : Buffer.from(stored, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  try {
    return JSON.parse(plaintext);
  } catch {
    return null;
  }
}
