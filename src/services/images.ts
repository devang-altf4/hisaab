import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';
import { badRequest } from '../lib/errors.js';
import { newId } from '../lib/ids.js';

/**
 * Local-disk image storage under /uploads (served statically).
 * Swap for S3 / Cloudflare R2 before running more than one server instance.
 */
export const UPLOAD_DIR = config.UPLOAD_DIR || join(process.cwd(), 'uploads');
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export function assertImage(mimeType: string, size: number) {
  if (!EXT[mimeType]) throw badRequest(`Unsupported image type ${mimeType}. Use JPEG, PNG, WebP or HEIC.`);
  if (size > MAX_IMAGE_BYTES) throw badRequest('Image too large (max 8 MB). Resize to ~1024px before upload.');
}

/** Saves and returns the public path, e.g. "/uploads/abc.jpg". */
export async function saveImage(data: Buffer, mimeType: string): Promise<string> {
  assertImage(mimeType, data.length);
  await mkdir(UPLOAD_DIR, { recursive: true });
  const file = `${newId()}.${EXT[mimeType]}`;
  await writeFile(join(UPLOAD_DIR, file), data);
  return `/uploads/${file}`;
}

export async function deleteImage(publicPath: string | null) {
  if (!publicPath?.startsWith('/uploads/')) return;
  await unlink(join(UPLOAD_DIR, publicPath.slice('/uploads/'.length))).catch(() => {});
}
