import crypto from 'node:crypto';
import { isFirebaseEnabled } from './firebase-admin.js';

const FIREBASE_STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ?? process.env.STORAGE_BUCKET ?? '';

/**
 * Checks whether any cloud storage provider is configured.
 */
export function isCloudStorageConfigured() {
  return Boolean(isFirebaseEnabled() && FIREBASE_STORAGE_BUCKET);
}

/**
 * Extracts binary buffer, MIME type, and file extension from a Base64 data URI.
 */
export function extractBase64Buffer(dataUri) {
  if (typeof dataUri !== 'string') return null;
  const match = dataUri.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;

  const mimeSubtype = match[1].toLowerCase();
  const extension = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype;
  const mimeType = `image/${mimeSubtype}`;
  const buffer = Buffer.from(match[2], 'base64');

  return { buffer, mimeType, extension };
}

export function firebaseMediaPath(mediaUrl, bucketName = FIREBASE_STORAGE_BUCKET) {
  if (!bucketName || typeof mediaUrl !== 'string') return null;
  try {
    const url = new URL(mediaUrl);
    const prefix = `/v0/b/${bucketName}/o/`;
    if (url.hostname !== 'firebasestorage.googleapis.com' || !url.pathname.startsWith(prefix)) {
      return null;
    }
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

/**
 * Uploads an image (Base64 data URI) to cloud storage if configured.
 * Returns the hosted HTTPS URL on success, or the original mediaData as fail-safe fallback.
 */
export async function uploadMedia(mediaData, folder = 'tickets') {
  if (!mediaData || typeof mediaData !== 'string') {
    return mediaData ?? null;
  }

  // Already a hosted URL
  if (/^https?:\/\//i.test(mediaData)) {
    return mediaData;
  }

  const parsed = extractBase64Buffer(mediaData);
  if (!parsed) {
    return mediaData;
  }

  // If Firebase Storage is available and configured
  if (isFirebaseEnabled() && FIREBASE_STORAGE_BUCKET) {
    try {
      const { getStorage } = await import('firebase-admin/storage');
      const bucket = getStorage().bucket(FIREBASE_STORAGE_BUCKET);
      const filename = `${folder}/${Date.now()}-${crypto.randomUUID()}.${parsed.extension}`;
      const downloadToken = crypto.randomUUID();
      const file = bucket.file(filename);

      await file.save(parsed.buffer, {
        metadata: {
          contentType: parsed.mimeType,
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: { firebaseStorageDownloadTokens: downloadToken },
        },
      });

      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(filename)}?alt=media&token=${downloadToken}`;
      return downloadUrl;
    } catch (err) {
      console.warn('[storage] Firebase upload failed, falling back to inline data:', err.message);
      return mediaData;
    }
  }

  // Fallback to inline Base64 data
  return mediaData;
}

export async function deleteMedia(mediaUrl) {
  const filename = firebaseMediaPath(mediaUrl);
  if (!filename || !isFirebaseEnabled()) return false;

  const { getStorage } = await import('firebase-admin/storage');
  await getStorage().bucket(FIREBASE_STORAGE_BUCKET).file(filename).delete({ ignoreNotFound: true });
  return true;
}
