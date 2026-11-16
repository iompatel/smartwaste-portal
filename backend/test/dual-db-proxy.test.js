import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-length-12345';

const { selectAuxiliaryStore } = await import('../src/server.js');

test('one auxiliary store is selected before traffic is accepted', () => {
  assert.equal(
    selectAuxiliaryStore({
      d1Configured: true,
      d1Initialized: true,
      secondaryConfigured: true,
      secondaryReady: true,
    }),
    'd1',
  );
  assert.equal(
    selectAuxiliaryStore({
      d1Configured: true,
      d1Initialized: false,
      secondaryConfigured: true,
      secondaryReady: true,
    }),
    null,
  );
  assert.equal(
    selectAuxiliaryStore({
      d1Configured: false,
      d1Initialized: false,
      secondaryConfigured: true,
      secondaryReady: true,
    }),
    'secondary',
  );
  assert.equal(
    selectAuxiliaryStore({
      d1Configured: false,
      d1Initialized: false,
      secondaryConfigured: true,
      secondaryReady: false,
    }),
    null,
  );
  assert.equal(
    selectAuxiliaryStore({
      d1Configured: false,
      d1Initialized: false,
      secondaryConfigured: false,
      secondaryReady: false,
    }),
    'primary',
  );
});
