import test from 'node:test';
import assert from 'node:assert/strict';
import { isD1Configured, D1_SCHEMA_SQL, D1WorkerLocation, D1TicketMessage } from '../src/cloudflare-d1.js';

test('isD1Configured returns false when env variables are unset', () => {
  assert.equal(isD1Configured(), false);
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
