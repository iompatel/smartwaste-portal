import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKER_LOCATION_TTL_MS,
  isFreshWorkerLocation,
  normalizeWorkerLocation,
} from '../src/location-policy.js';

test('worker coordinates are bounded and numeric', () => {
  assert.deepEqual(
    normalizeWorkerLocation({ latitude: '23.0225', longitude: '72.5714', accuracy: '12' }),
    { latitude: 23.0225, longitude: 72.5714, accuracy: 12 },
  );
  assert.equal(normalizeWorkerLocation({ latitude: 91, longitude: 0, accuracy: 1 }), null);
  assert.equal(normalizeWorkerLocation({ latitude: 0, longitude: 181, accuracy: 1 }), null);
  assert.equal(normalizeWorkerLocation({ latitude: 0, longitude: 0, accuracy: 5001 }), null);
});

test('worker locations expire after two minutes', () => {
  const now = Date.now();
  assert.equal(isFreshWorkerLocation(new Date(now - WORKER_LOCATION_TTL_MS + 1), now), true);
  assert.equal(isFreshWorkerLocation(new Date(now - WORKER_LOCATION_TTL_MS - 1), now), false);
});
