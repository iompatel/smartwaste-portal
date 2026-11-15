import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canWorkerTransition,
  createCompletionCode,
  isClosedTicket,
  ticketSlaHours,
} from '../src/ticket-policy.js';

test('hire request status validations and worker lifecycle', () => {
  const allowedHireStatuses = ['pending', 'assigned', 'completed', 'cancelled'];
  assert.equal(allowedHireStatuses.includes('pending'), true);
  assert.equal(allowedHireStatuses.includes('assigned'), true);
  assert.equal(allowedHireStatuses.includes('completed'), true);
  assert.equal(allowedHireStatuses.includes('cancelled'), true);
  assert.equal(allowedHireStatuses.includes('unknown_status'), false);
});

test('review rating limits and comment length constraints', () => {
  const validateReview = (rating, comment) => {
    return (
      Number.isInteger(rating) &&
      rating >= 1 &&
      rating <= 5 &&
      typeof comment === 'string' &&
      comment.trim().length <= 500
    );
  };

  assert.equal(validateReview(5, 'Great job!'), true);
  assert.equal(validateReview(1, 'Poor collection.'), true);
  assert.equal(validateReview(0, 'Invalid rating'), false);
  assert.equal(validateReview(6, 'Out of bounds'), false);
  assert.equal(validateReview(4.5, 'Decimal not allowed'), false);
  assert.equal(validateReview(5, 'x'.repeat(501)), false);
});

test('ticket sla overdue logic matches targets', () => {
  assert.equal(ticketSlaHours('high'), 2);
  assert.equal(ticketSlaHours('medium'), 8);
  assert.equal(ticketSlaHours('low'), 24);

  assert.equal(isClosedTicket('completed'), true);
  assert.equal(isClosedTicket('cancelled'), true);
  assert.equal(isClosedTicket('in_progress'), false);
});
