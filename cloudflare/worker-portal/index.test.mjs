import assert from 'node:assert/strict';
import test from 'node:test';

import worker from './index.mjs';

test('proxies only the worker hostname to the Render static site', async () => {
  const originalFetch = globalThis.fetch;
  let forwardedUrl = '';
  globalThis.fetch = async (request) => {
    forwardedUrl = request.url;
    return new Response('worker portal');
  };

  try {
    const response = await worker.fetch(
      new Request('https://worker.smartwaste.dpdns.org/worker-console?from=test'),
    );
    assert.equal(response.status, 200);
    assert.equal(
      forwardedUrl,
      'https://smartwaste-worker.onrender.com/worker-console?from=test',
    );

    const rejected = await worker.fetch(new Request('https://example.com/worker-console'));
    assert.equal(rejected.status, 404);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
