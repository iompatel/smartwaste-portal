import assert from 'node:assert/strict';
import test from 'node:test';

import { canUseLoginPortal, isStrongPassword } from '../src/auth-policy.js';

test('password policy requires length, uppercase, and a special character', () => {
  assert.equal(isStrongPassword('Admin#123'), true);
  assert.equal(isStrongPassword('admin#123'), false);
  assert.equal(isStrongPassword('Admin1234'), false);
  assert.equal(isStrongPassword('A#123'), false);
});

test('public and admin login portals accept only their intended roles', () => {
  assert.equal(canUseLoginPortal('admin', 'admin'), true);
  assert.equal(canUseLoginPortal('admin', 'public'), false);
  assert.equal(canUseLoginPortal('worker', 'public'), true);
  assert.equal(canUseLoginPortal('user', 'public'), true);
  assert.equal(canUseLoginPortal('worker', 'admin'), false);
});
