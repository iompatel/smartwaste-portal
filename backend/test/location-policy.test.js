import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKER_LOCATION_TTL_MS,
  calculateBearing,
  distanceMeters,
  isFreshWorkerLocation,
  normalizeCoordinates,
  normalizeWorkerLocation,
} from '../src/location-policy.js';

test('worker coordinates are bounded and numeric', () => {
  assert.deepEqual(
    normalizeWorkerLocation({ latitude: '23.0225', longitude: '72.5714', accuracy: '12' }),
    { latitude: 23.0225, longitude: 72.5714, accuracy: 12 },
  );
  assert.deepEqual(
    normalizeWorkerLocation({ latitude: '23.0225', longitude: '72.5714', accuracy: '12', heading: 90, speed: 14.5 }),
    { latitude: 23.0225, longitude: 72.5714, accuracy: 12, heading: 90, speed: 14.5 },
  );
  assert.equal(normalizeWorkerLocation({ latitude: 91, longitude: 0, accuracy: 1 }), null);
  assert.equal(normalizeWorkerLocation({ latitude: 0, longitude: 181, accuracy: 1 }), null);
  assert.equal(normalizeWorkerLocation({ latitude: 0, longitude: 0, accuracy: 5001 }), null);
});

test('calculateBearing returns accurate compass azimuth angles', () => {
  assert.equal(calculateBearing({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }), 0);
  assert.equal(calculateBearing({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }), 90);
  assert.equal(calculateBearing({ latitude: 1, longitude: 0 }, { latitude: 0, longitude: 0 }), 180);
  assert.equal(calculateBearing({ latitude: 0, longitude: 1 }, { latitude: 0, longitude: 0 }), 270);
});

test('worker locations expire after two minutes', () => {
  const now = Date.now();
  assert.equal(isFreshWorkerLocation(new Date(now - WORKER_LOCATION_TTL_MS + 1), now), true);
  assert.equal(isFreshWorkerLocation(new Date(now - WORKER_LOCATION_TTL_MS - 1), now), false);
});

test('destination coordinates and proximity distances are validated', () => {
  assert.deepEqual(normalizeCoordinates({ latitude: '23.0225', longitude: '72.5714' }), {
    latitude: 23.0225,
    longitude: 72.5714,
  });
  assert.equal(normalizeCoordinates({ latitude: Infinity, longitude: 0 }), null);
  assert.equal(normalizeCoordinates({ latitude: null, longitude: 72.5714 }), null);
  assert.equal(distanceMeters(
    { latitude: 23.0225, longitude: 72.5714 },
    { latitude: 23.0225, longitude: 72.5714 },
  ), 0);
  assert.ok(distanceMeters(
    { latitude: 23.0225, longitude: 72.5714 },
    { latitude: 23.027, longitude: 72.5714 },
  ) > 490);
});
