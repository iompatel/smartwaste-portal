export type LoginPortal = 'user' | 'worker' | 'admin';

type ErrorLike = {
  code?: unknown;
  status?: unknown;
  error?: unknown;
};

function responseMessage(error: ErrorLike) {
  const body = error.error;
  if (body && typeof body === 'object' && 'message' in body) {
    return String((body as { message?: unknown }).message ?? '').trim();
  }
  return typeof body === 'string' ? body.trim() : '';
}

export function loginErrorMessage(error: unknown, portal: LoginPortal) {
  const source = (error ?? {}) as ErrorLike;
  const code = String(source.code ?? '');
  const status = Number(source.status ?? 0);
  const message = responseMessage(source);

  if (
    code.includes('auth/invalid-credential') ||
    code.includes('auth/user-not-found') ||
    code.includes('auth/wrong-password')
  ) {
    return 'Invalid email or password.';
  }

  if (portal === 'admin' && /authentication required/i.test(message)) {
    return 'Admin gateway access expired. Reload the admin URL, complete the gateway sign-in, then try again.';
  }

  if (message) return message;

  if (status === 0) {
    if (portal === 'admin') {
      return 'Cannot reach the Admin Console. Open admin.smartwaste.dpdns.org directly and try again.';
    }
    if (portal === 'worker') {
      return 'Cannot reach the Worker Console. Open worker.smartwaste.dpdns.org directly and try again.';
    }
    return 'Cannot reach the login service. Check your connection and try again.';
  }

  if (status === 429) return 'Too many login attempts. Wait a few minutes and try again.';
  if ([502, 503, 504].includes(status)) {
    return 'The login service is starting. Wait a moment and try again.';
  }
  if (status === 401) {
    return portal === 'admin' ? 'Invalid admin credentials.' : 'Invalid email or password.';
  }

  return `Unable to access the ${portal === 'user' ? 'User Portal' : portal === 'worker' ? 'Worker Console' : 'Admin Console'}.`;
}

export function shouldFallbackToPasswordLogin(error: unknown) {
  const source = (error ?? {}) as ErrorLike;
  const code = String(source.code ?? '');
  const status = Number(source.status ?? 0);
  const message = responseMessage(source);

  return (
    code.startsWith('auth/') ||
    status >= 500 ||
    (status === 401 && message === 'Invalid Firebase token.')
  );
}
