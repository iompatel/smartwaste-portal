import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isD1Configured,
  isD1PartiallyConfigured,
  isD1Ready,
  D1_SCHEMA_SQL,
  D1WorkerLocation,
  D1TicketMessage,
} from '../src/cloudflare-d1.js';

test('isD1Configured returns false when env variables are unset', () => {
  assert.equal(isD1Configured(), false);
  assert.equal(isD1PartiallyConfigured(), false);
  assert.equal(isD1Ready(), false);
});

test('D1_SCHEMA_SQL defines worker_locations and ticket_messages with indexes', () => {
  assert.match(D1_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS worker_locations/);
  assert.match(D1_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS ticket_messages/);
  assert.match(D1_SCHEMA_SQL, /CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id/);
});

test('D1WorkerLocation throws descriptive error when unconfigured', async () => {
  await assert.rejects(
    async () => {
      await D1WorkerLocation.findOne({ workerId: 1 });
    },
    { message: /Cloudflare D1 is not configured/ }
  );
});

test('D1WorkerLocation cleanup refuses to pretend an unconfigured store succeeded', async () => {
  await assert.rejects(() => D1WorkerLocation.deleteExpired(), {
    message: /Cloudflare D1 is not configured/,
  });
});

test('D1TicketMessage throws descriptive error when unconfigured', async () => {
  await assert.rejects(
    async () => {
      await D1TicketMessage.create({ id: 1, ticketId: 1, senderId: 1, senderRole: 'user', message: 'test' });
    },
    { message: /Cloudflare D1 is not configured/ }
  );
});

test('D1TicketMessage find provides chainable sort and limit', () => {
  const query = D1TicketMessage.find({ ticketId: 10 }).sort({ createdAt: 1 }).limit(50);
  assert.equal(typeof query.then, 'function');
});

test('D1TicketMessage deleteMany handles empty filter without throwing', async () => {
  const result = await D1TicketMessage.deleteMany({});
  assert.equal(result.acknowledged, true);
});

test('D1TicketMessage deleteMany with $or branches attempts cleanup for each branch', async () => {
  // When unconfigured, a branch with senderId attempts queryD1 which throws descriptive error
  await assert.rejects(
    async () => {
      await D1TicketMessage.deleteMany({
        $or: [{ senderId: 42 }, { ticketId: 100 }],
      });
    },
    { message: /Cloudflare D1 is not configured/ }
  );
});

test('partial D1 environment configuration is detectable', async () => {
  process.env.CF_ACCOUNT_ID = 'account-only';
  try {
    const partial = await import(`../src/cloudflare-d1.js?partial=${Date.now()}`);
    assert.equal(partial.isD1Configured(), false);
    assert.equal(partial.isD1PartiallyConfigured(), true);
  } finally {
    delete process.env.CF_ACCOUNT_ID;
  }
});

test('configured D1 readiness follows real REST success and failure', async () => {
  const originalFetch = globalThis.fetch;
  process.env.CF_ACCOUNT_ID = 'account';
  process.env.CF_D1_DATABASE_ID = 'database';
  process.env.CF_API_TOKEN = 'token';
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: true, result: [{ results: [] }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const configured = await import(`../src/cloudflare-d1.js?configured=${Date.now()}`);
    assert.equal(await configured.initD1Tables(), true);
    assert.equal(configured.isD1Ready(), true);

    globalThis.fetch = async () => {
      throw new Error('provider unavailable');
    };
    await assert.rejects(() => configured.queryD1('SELECT 1'), /provider unavailable/);
    assert.equal(configured.isD1Ready(), false);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_D1_DATABASE_ID;
    delete process.env.CF_API_TOKEN;
  }
});
