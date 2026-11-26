import { baseHeaders, randomToken, type Env } from './env';

// Screenshots attached to feedback (data roadmap, phase 2). Stored in the
// private R2 bucket bound as BACKUPS under feedback/ (weekly backup pruning
// only touches d1/). Only /admin/manage serves them back, and only to the
// owner. The type is read from the file's first bytes, never trusted from
// the browser.

export const MAX_FILE = 3 * 1024 * 1024;
const PREFIX = 'feedback/';

const sniff = (bytes: Uint8Array) => {
  const at = (offset: number, ...values: number[]) =>
    values.every((value, i) => bytes[offset + i] === value);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { type: 'image/png', ext: 'png' };
  if (at(0, 0xff, 0xd8, 0xff)) return { type: 'image/jpeg', ext: 'jpg' };
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50))
    return { type: 'image/webp', ext: 'webp' };
  return null;
};

export type Upload = { bytes: Uint8Array; type: string; ext: string };

/**
 * Checks an uploaded file: an image of a supported type within MAX_FILE.
 * Returns null when there is no file, or an error code.
 */
export async function readUpload(
  value: File | string | null,
): Promise<Upload | null | 'too_large' | 'bad_file'> {
  if (!value || typeof value === 'string' || value.size === 0) return null;
  if (value.size > MAX_FILE) return 'too_large';
  const bytes = new Uint8Array(await value.arrayBuffer());
  const kind = sniff(bytes);
  return kind ? { bytes, ...kind } : 'bad_file';
}

export async function storeUpload(env: Env, upload: Upload) {
  if (!env.BACKUPS) throw new Error('no BACKUPS binding');
  const key = `${PREFIX}${new Date().toISOString().slice(0, 10)}-${randomToken(12)}.${upload.ext}`;
  await env.BACKUPS.put(key, upload.bytes, {
    httpMetadata: { contentType: upload.type },
  });
  return key;
}

export async function deleteUpload(env: Env, key: unknown) {
  if (typeof key === 'string' && key.startsWith(PREFIX) && env.BACKUPS)
    await env.BACKUPS.delete(key);
}

/** The image for one feedback row, for the owner panel only. */
export async function serveUpload(env: Env, key: unknown, type: unknown) {
  if (typeof key !== 'string' || !key.startsWith(PREFIX) || !env.BACKUPS)
    return null;
  const object = await env.BACKUPS.get(key);
  if (!object) return null;
  return new Response(object.body, {
    headers: {
      ...baseHeaders,
      'Content-Type': String(type ?? 'application/octet-stream'),
      'Content-Disposition': 'inline',
      // A picture only: nothing in it can run, even if a browser tried.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-store',
    },
  });
}
