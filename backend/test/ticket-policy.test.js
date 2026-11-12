import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canWorkerTransition,
  createCompletionCode,
  isClosedTicket,
  isValidImageData,
  ticketSlaHours,
} from '../src/ticket-policy.js';

test('worker ticket transitions enforce the tracked lifecycle', () => {
  assert.equal(canWorkerTransition('assigned', 'accepted'), true);
  assert.equal(canWorkerTransition('accepted', 'in_progress'), true);
  assert.equal(canWorkerTransition('in_progress', 'completed'), true);
  assert.equal(canWorkerTransition('pending', 'completed'), false);
  assert.equal(canWorkerTransition('completed', 'in_progress'), false);
});

test('completion codes are always six digits', () => {
  assert.match(createCompletionCode(), /^\d{6}$/);
});

test('ticket media accepts bounded image data only', () => {
  assert.equal(isValidImageData(null), true);
  assert.equal(isValidImageData(null, { required: true }), false);
  assert.equal(isValidImageData('data:image/jpeg;base64,YQ=='), true);
  assert.equal(isValidImageData('data:text/html;base64,YQ=='), false);
});

test('closed statuses and SLA targets are stable', () => {
  assert.equal(isClosedTicket('completed'), true);
  assert.equal(isClosedTicket('cancelled'), true);
  assert.equal(isClosedTicket('pending'), false);
  assert.equal(ticketSlaHours('high'), 2);
  assert.equal(ticketSlaHours('medium'), 8);
  assert.equal(ticketSlaHours('low'), 24);
});
