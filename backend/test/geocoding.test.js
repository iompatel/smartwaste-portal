import assert from 'node:assert/strict';
import test from 'node:test';

import { photonSuggestions } from '../src/geocoding.js';

test('Photon results become bounded, unique address suggestions', () => {
  const feature = {
    geometry: { coordinates: [72.5714, 23.0225] },
    properties: { name: 'City Hall', street: 'Main Road', city: 'Ahmedabad', country: 'India' },
  };
  assert.deepEqual(photonSuggestions({ features: [feature, feature, { geometry: {} }] }), [{
    label: 'City Hall, Main Road, Ahmedabad, India',
    latitude: 23.0225,
    longitude: 72.5714,
  }]);
});
