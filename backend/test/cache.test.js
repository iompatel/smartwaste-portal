import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCache } from '../src/cache.js';

test('MemoryCache sets and gets values within TTL', () => {
  const cache = new MemoryCache(1000);
  cache.set('test-key', { count: 42 });
  assert.deepEqual(cache.get('test-key'), { count: 42 });
  assert.equal(cache.has('test-key'), true);
});

test('MemoryCache returns null for expired keys', async () => {
  const cache = new MemoryCache(50);
  cache.set('short-lived', 'hello', 30);
  assert.equal(cache.get('short-lived'), 'hello');
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(cache.get('short-lived'), null);
  assert.equal(cache.has('short-lived'), false);
});

test('MemoryCache invalidates keys by prefix', () => {
  const cache = new MemoryCache(5000);
  cache.set('worker:1:reviews', [5, 4]);
  cache.set('worker:2:reviews', [3]);
  cache.set('ticket:10', { id: 10 });

  cache.invalidate('worker:');
  assert.equal(cache.get('worker:1:reviews'), null);
  assert.equal(cache.get('worker:2:reviews'), null);
  assert.deepEqual(cache.get('ticket:10'), { id: 10 });
});

test('MemoryCache clear and size', () => {
  const cache = new MemoryCache(5000);
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.size, 2);
  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(cache.get('a'), null);
});
