import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adminCookieName,
  adminSessionTtlMs,
  createAdminSecret,
  hashAdminSecret,
  matchesAdminSecret,
  readCookie,
} from '../src/admin-session.js';

test('admin secrets are random, hashable, and compared safely', () => {
  const secret = createAdminSecret();
  const other = createAdminSecret();
  const hash = hashAdminSecret(secret);

  assert.notEqual(secret, other);
  assert.equal(matchesAdminSecret(secret, hash), true);
  assert.equal(matchesAdminSecret(other, hash), false);
});

test('cookie parsing returns only the requested cookie', () => {
  assert.equal(readCookie('other=1; swms_admin_session=abc%20123', 'swms_admin_session'), 'abc 123');
  assert.equal(readCookie('other=1', 'swms_admin_session'), null);
});

test('session TTL is bounded and cookie prefix is production-only', () => {
  assert.equal(adminSessionTtlMs('1'), 5 * 60 * 1000);
  assert.equal(adminSessionTtlMs('30'), 30 * 60 * 1000);
  assert.equal(adminSessionTtlMs('999'), 120 * 60 * 1000);
  assert.equal(adminCookieName(false), 'swms_admin_session');
  assert.equal(adminCookieName(true), '__Host-swms_admin_session');
});
