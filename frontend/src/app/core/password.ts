// Shared password policy for every place a password is created.
export const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,}$/;
export const PASSWORD_HINT =
  'At least 8 characters, including one uppercase letter and one special character.';
