import crypto from 'node:crypto';

export const TICKET_STATUSES = [
  'pending',
  'assigned',
  'accepted',
  'in_progress',
  'completed',
  'cancelled',
];

export const TICKET_PRIORITIES = ['low', 'medium', 'high'];
export const MAX_IMAGE_DATA_LENGTH = 2_000_000;
export const MAX_TICKET_TEXT_LENGTH = 1_000;

const WORKER_TRANSITIONS = {
  pending: ['accepted'],
  assigned: ['accepted'],
  accepted: ['in_progress'],
  in_progress: ['completed'],
};

export function canWorkerTransition(from, to) {
  return WORKER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isClosedTicket(status) {
  return ['completed', 'cancelled'].includes(status);
}

export function createCompletionCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function isValidImageData(value, { required = false } = {}) {
  if (value === null || value === undefined || value === '') {
    return !required;
  }
  const text = String(value);
  return (
    text.length <= MAX_IMAGE_DATA_LENGTH &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(text)
  );
}

export function ticketSlaHours(priority) {
  return priority === 'high' ? 2 : priority === 'low' ? 24 : 8;
}
