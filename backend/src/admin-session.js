import crypto from 'node:crypto';

const DEFAULT_TTL_MINUTES = 30;
const MIN_TTL_MINUTES = 5;
const MAX_TTL_MINUTES = 120;

export function createAdminSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashAdminSecret(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

export function matchesAdminSecret(value, expectedHash) {
  const actual = Buffer.from(hashAdminSecret(value), 'hex');
  const expected = Buffer.from(String(expectedHash ?? ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function readCookie(header, name) {
  const prefix = `${name}=`;
  const value = String(header ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value.slice(prefix.length));
  } catch {
    return null;
  }
}

export function adminSessionTtlMs(value) {
  const parsed = Number(value ?? DEFAULT_TTL_MINUTES);
  const minutes = Number.isFinite(parsed)
    ? Math.min(MAX_TTL_MINUTES, Math.max(MIN_TTL_MINUTES, parsed))
    : DEFAULT_TTL_MINUTES;
  return minutes * 60 * 1000;
}

export function adminCookieName(production) {
  return production ? '__Host-swms_admin_session' : 'swms_admin_session';
}
