export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include one uppercase letter and one special character.';

export function isStrongPassword(value) {
  return /^(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,}$/.test(String(value ?? ''));
}

export function canUseLoginPortal(role, portal) {
  const roleByPortal = {
    admin: 'admin',
    worker: 'worker',
    public: 'user',
  };

  return roleByPortal[portal] === role;
}

export function usesFirebasePasswordProvider(payload) {
  return payload?.firebase?.sign_in_provider === 'password';
}

// IP headers can be supplied by the caller, so password throttling also keys on
// the account being attempted. Mirrors the identifier handling in the login handler.
export function loginIdentityKey(body, fallback) {
  const identifier = String(body?.email ?? body?.id ?? body?.identifier ?? '')
    .trim()
    .toLowerCase();
  return identifier || fallback;
}

export function tokenVersionMatches(payload, user) {
  return Number(payload?.tokenVersion ?? 0) === Number(user?.tokenVersion ?? 0);
}

export function isNotificationTargetRole(value) {
  return ['user', 'worker', 'admin'].includes(value);
}
