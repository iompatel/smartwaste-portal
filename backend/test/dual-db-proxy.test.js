import test from 'node:test';
import assert from 'node:assert/strict';

test('Dual DB Proxy routes to secondary when healthy and falls back to primary', () => {
  let isHealthy = false;
  let connectionState = 0; // 0 = disconnected, 1 = connected

  const primaryModel = {
    name: 'PrimaryModel',
    find(query) {
      return `primary find: ${JSON.stringify(query)}`;
    },
    count: 10,
  };

  const secondaryModel = {
    name: 'SecondaryModel',
    find(query) {
      return `secondary find: ${JSON.stringify(query)}`;
    },
    count: 20,
  };

  function getActiveModel(secondary, primary) {
    if ((connectionState === 1 || isHealthy) && secondary) {
      return secondary;
    }
    return primary;
  }

  const modelProxy = new Proxy(primaryModel, {
    get(_target, prop) {
      const model = getActiveModel(secondaryModel, primaryModel);
      const val = model[prop];
      return typeof val === 'function' ? val.bind(model) : val;
    },
  });

  // When disconnected / unhealthy -> uses primary
  assert.equal(modelProxy.name, 'PrimaryModel');
  assert.equal(modelProxy.count, 10);
  assert.equal(modelProxy.find({ test: 1 }), 'primary find: {"test":1}');

  // When secondary becomes connected -> seamlessly routes to secondary
  connectionState = 1;
  isHealthy = true;
  assert.equal(modelProxy.name, 'SecondaryModel');
  assert.equal(modelProxy.count, 20);
  assert.equal(modelProxy.find({ test: 1 }), 'secondary find: {"test":1}');

  // When secondary disconnects -> immediately falls back to primary
  connectionState = 0;
  isHealthy = false;
  assert.equal(modelProxy.name, 'PrimaryModel');
  assert.equal(modelProxy.count, 10);
  assert.equal(modelProxy.find({ test: 1 }), 'primary find: {"test":1}');
});
