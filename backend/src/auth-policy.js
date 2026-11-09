export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include one uppercase letter and one special character.';

export function isStrongPassword(value) {
  return /^(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,}$/.test(String(value ?? ''));
}

export function canUseLoginPortal(role, portal) {
  return portal === 'admin' ? role === 'admin' : role === 'worker' || role === 'user';
}
