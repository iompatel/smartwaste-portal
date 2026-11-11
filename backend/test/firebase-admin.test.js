import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

test('valid modular Firebase credentials enable token verification support', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    project_id: 'firebase-import-test',
    client_email: 'firebase-admin@example.test',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });

  try {
    const firebase = await import(`../src/firebase-admin.js?test=${Date.now()}`);
    assert.equal(firebase.isFirebaseEnabled(), true);
  } finally {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  }
});
