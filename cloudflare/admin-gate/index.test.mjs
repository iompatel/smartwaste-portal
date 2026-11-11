import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { originFor } from './index.mjs';

test('routes admin API paths to the backend on the same hostname', () => {
  assert.equal(
    originFor(new URL('https://admin.smartwaste.dpdns.org/api/me')),
    'https://smartwaste-admin-backend.onrender.com',
  );
  assert.equal(
    originFor(new URL('https://admin.smartwaste.dpdns.org/admin-console')),
    'https://smartwaste-admin.onrender.com',
  );
  assert.equal(
    originFor(new URL('https://admin-api.smartwaste.dpdns.org/api/health')),
    'https://smartwaste-admin-backend.onrender.com',
  );
});

test('keeps the Basic credential at the edge', async () => {
  const originalFetch = globalThis.fetch;
  let forwardedRequest;
  globalThis.fetch = async (request) => {
    forwardedRequest = request;
    return new Response('ok');
  };

  try {
    const unauthorized = await worker.fetch(
      new Request('https://admin.smartwaste.dpdns.org/api/health'),
      { BASIC_USER: 'admin', BASIC_PASS: 'secret', EDGE_SECRET: 'edge' },
    );
    assert.equal(unauthorized.status, 401);

    const authorized = await worker.fetch(
      new Request('https://admin.smartwaste.dpdns.org/api/health', {
        headers: { Authorization: `Basic ${btoa('admin:secret')}` },
      }),
      { BASIC_USER: 'admin', BASIC_PASS: 'secret', EDGE_SECRET: 'edge' },
    );
    assert.equal(authorized.status, 200);
    assert.equal(forwardedRequest.url, 'https://smartwaste-admin-backend.onrender.com/api/health');
    assert.equal(forwardedRequest.headers.has('Authorization'), false);
    assert.equal(forwardedRequest.headers.get('X-Admin-Edge'), 'edge');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
