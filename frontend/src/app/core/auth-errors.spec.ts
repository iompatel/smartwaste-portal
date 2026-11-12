import { loginErrorMessage, shouldFallbackToPasswordLogin } from './auth-errors';

describe('loginErrorMessage', () => {
  it('keeps useful API messages', () => {
    expect(
      loginErrorMessage({ status: 403, error: { message: 'Worker access is required.' } }, 'worker'),
    ).toBe('Worker access is required.');
  });

  it('explains network and admin gateway failures', () => {
    expect(loginErrorMessage({ status: 0 }, 'worker')).toContain('worker.smartwaste.dpdns.org');
    expect(
      loginErrorMessage({ status: 401, error: 'Authentication required' }, 'admin'),
    ).toContain('gateway access expired');
  });

  it('maps credential and rate-limit failures', () => {
    expect(loginErrorMessage({ code: 'auth/invalid-credential' }, 'user')).toBe(
      'Invalid email or password.',
    );
    expect(loginErrorMessage({ status: 429 }, 'admin')).toContain('Too many login attempts');
  });
});

describe('shouldFallbackToPasswordLogin', () => {
  it('falls back for Firebase/client availability failures', () => {
    expect(shouldFallbackToPasswordLogin({ code: 'auth/network-request-failed' })).toBeTrue();
    expect(shouldFallbackToPasswordLogin({ status: 503 })).toBeTrue();
    expect(
      shouldFallbackToPasswordLogin({
        status: 401,
        error: { message: 'Invalid Firebase token.' },
      }),
    ).toBeTrue();
  });

  it('preserves role errors returned by the backend', () => {
    expect(
      shouldFallbackToPasswordLogin({
        status: 403,
        error: { message: 'Worker accounts must use the Worker Console.' },
      }),
    ).toBeFalse();
  });
});
