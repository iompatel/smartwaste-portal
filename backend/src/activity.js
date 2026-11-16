import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    actorId: { type: Number, required: true },
    actorRole: { type: String, required: true, enum: ['user', 'worker', 'admin'] },
    actorName: { type: String, required: true, trim: true },
    actorEmail: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, default: null },
    targetId: { type: Number, default: null },
    summary: { type: String, required: true, trim: true },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'account_activities' },
);
activitySchema.index({ createdAt: -1, id: -1 });
activitySchema.index({ actorRole: 1, actorId: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });

export const AccountActivity = mongoose.model('AccountActivity', activitySchema);

export function accountActivitySnapshot(account) {
  if (!account) return null;
  const fields = ['id', 'firstName', 'lastName', 'email', 'role', 'gender', 'mobile', 'address',
    'createdAt', 'updatedAt', 'lastLoginAt', 'workerOnline', 'workerLastSeenAt', 'workerSkills'];
  return Object.fromEntries(fields.filter((key) => account[key] !== undefined).map((key) => [key, account[key]]));
}

export function ticketActivitySnapshot(ticket) {
  if (!ticket) return null;
  const fields = ['id', 'ticketCode', 'userId', 'workerId', 'wasteType', 'description',
    'locationAddress', 'priority', 'status', 'acceptedAt', 'startedAt', 'completedAt',
    'cancelledAt', 'createdAt', 'updatedAt'];
  const result = Object.fromEntries(fields.filter((key) => ticket[key] !== undefined).map((key) => [key, ticket[key]]));
  result.beforeImageUrl = /^https:\/\//i.test(ticket.mediaData ?? '') ? ticket.mediaData : null;
  result.afterImageUrl = /^https:\/\//i.test(ticket.completionMediaData ?? '') ? ticket.completionMediaData : null;
  result.hasBeforeImage = Boolean(ticket.mediaData);
  result.hasAfterImage = Boolean(ticket.completionMediaData);
  result.statusHistory = Array.from(ticket.statusHistory ?? []).map((event) => ({
    status: event.status, actorId: event.actorId, actorRole: event.actorRole,
    note: event.note, createdAt: event.createdAt,
  }));
  return result;
}

export function activityDateRange({ from, to } = {}) {
  const parse = (value, endOfDay) => {
    if (value === undefined || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
      throw new Error('Dates must use ISO format.');
    }
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = new Date(dateOnly ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z` : value);
    if (!Number.isFinite(date.getTime()) || (dateOnly && date.toISOString().slice(0, 10) !== value)) {
      throw new Error('Dates must use valid ISO dates.');
    }
    return date;
  };
  const start = parse(from, false);
  const end = parse(to, true);
  if (start && end && start > end) throw new Error('The start date must be before the end date.');
  return { from: start, to: end };
}

export function activityQuery(query = {}) {
  const filter = {};
  if (query.role) {
    if (!['user', 'worker', 'admin'].includes(query.role)) throw new Error('Invalid activity role.');
    filter.actorRole = query.role;
  }
  if (query.actorId !== undefined && query.actorId !== '') {
    const actorId = Number(query.actorId);
    if (!Number.isSafeInteger(actorId) || actorId <= 0) throw new Error('Invalid actor id.');
    filter.actorId = actorId;
  }
  if (query.action) {
    if (typeof query.action !== 'string' || query.action.length > 200) throw new Error('Invalid activity action.');
    filter.action = query.action;
  }
  const period = activityDateRange(query);
  if (period.from || period.to) {
    filter.createdAt = { ...(period.from ? { $gte: period.from } : {}), ...(period.to ? { $lte: period.to } : {}) };
  }
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 25);
  if (!Number.isSafeInteger(page) || page <= 0 || !Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error('Page and limit must be positive integers.');
  }
  const boundedLimit = Math.min(limit, 100);
  if (!Number.isSafeInteger((page - 1) * boundedLimit)) throw new Error('Page is too large.');
  return { filter, page, limit: boundedLimit };
}
