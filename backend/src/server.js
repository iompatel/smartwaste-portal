import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import mongoose from 'mongoose';

import {
  deleteFirebaseUser,
  getFirebaseUserByEmail,
  getFirebaseUserByUid,
  isFirebaseEnabled,
  updateFirebaseUser,
  verifyFirebaseIdToken,
} from './firebase-admin.js';
import {
  PASSWORD_POLICY_MESSAGE,
  canUseLoginPortal,
  isNotificationTargetRole,
  isStrongPassword,
  tokenVersionMatches,
  usesFirebasePasswordProvider,
} from './auth-policy.js';
import {
  adminCookieName,
  adminSessionTtlMs,
  createAdminSecret,
  hashAdminSecret,
  matchesAdminSecret,
  readCookie,
} from './admin-session.js';
import {
  MAX_TICKET_TEXT_LENGTH,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  canWorkerTransition,
  createCompletionCode,
  isClosedTicket,
  isValidImageData,
  ticketSlaHours,
} from './ticket-policy.js';
import {
  WORKER_LOCATION_TTL_MS,
  isFreshWorkerLocation,
  normalizeWorkerLocation,
} from './location-policy.js';
import { fastCache } from './cache.js';
import { deleteMedia, uploadMedia } from './storage.js';
import {
  AccountActivity,
  accountActivitySnapshot,
  ticketActivitySnapshot,
  activityDateRange,
  activityQuery,
} from './activity.js';
import {
  isD1Configured,
  isD1PartiallyConfigured,
  isD1Ready,
  initD1Tables,
  D1WorkerLocation,
  D1TicketMessage,
} from './cloudflare-d1.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required.');
}

const PORT = Number(process.env.PORT ?? 4000);
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/smart_waste_portal';
// Optional second database for high-churn worker location pings. When unset, everything stays on MONGO_URI.
const WORKER_LOCATION_MONGO_URI = process.env.WORKER_LOCATION_MONGO_URI ?? '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SERVICE_MODE = process.env.SERVICE_MODE ?? 'combined';
if (!['public', 'admin', 'combined'].includes(SERVICE_MODE)) {
  throw new Error('SERVICE_MODE must be public, admin, or combined.');
}
const PUBLIC_AUTH_ENABLED = SERVICE_MODE !== 'admin';
const ADMIN_AUTH_ENABLED = SERVICE_MODE !== 'public';
const REQUIRE_CF_ACCESS = process.env.REQUIRE_CF_ACCESS === 'true';
const CF_ACCESS_TEAM_DOMAIN = String(process.env.CF_ACCESS_TEAM_DOMAIN ?? '').replace(/\/$/, '');
const CF_ACCESS_AUD = String(process.env.CF_ACCESS_AUD ?? '');
const ADMIN_SESSION_TTL_MS = adminSessionTtlMs(process.env.ADMIN_SESSION_TTL_MINUTES);
const ADMIN_SESSION_COOKIE = adminCookieName(IS_PRODUCTION);
// SHA-256 of the header value that only the Cloudflare edge gate can add. When
// set, direct hits on the Render origin are rejected even if the host is known.
const ADMIN_EDGE_SECRET_HASH = String(process.env.ADMIN_EDGE_SECRET_HASH ?? '');
const SEED_ADMIN_EMAIL = normalizeEmail(process.env.SEED_ADMIN_EMAIL);
const SEED_ADMIN_PASSWORD = String(process.env.SEED_ADMIN_PASSWORD ?? '');

if (IS_PRODUCTION && PUBLIC_AUTH_ENABLED && !process.env.PUBLIC_FRONTEND_URL) {
  throw new Error('PUBLIC_FRONTEND_URL is required by the public backend.');
}
if (IS_PRODUCTION && ADMIN_AUTH_ENABLED && !process.env.ADMIN_FRONTEND_URL) {
  throw new Error('ADMIN_FRONTEND_URL is required by the admin backend.');
}
if (
  IS_PRODUCTION &&
  ADMIN_AUTH_ENABLED &&
  !REQUIRE_CF_ACCESS &&
  !/^[a-f0-9]{64}$/i.test(ADMIN_EDGE_SECRET_HASH)
) {
  throw new Error('A valid ADMIN_EDGE_SECRET_HASH is required by the admin backend.');
}
if (
  IS_PRODUCTION &&
  ADMIN_AUTH_ENABLED &&
  REQUIRE_CF_ACCESS &&
  (!CF_ACCESS_TEAM_DOMAIN || !CF_ACCESS_AUD)
) {
  throw new Error('CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD are required for Cloudflare Access.');
}

const cloudflareJwks =
  REQUIRE_CF_ACCESS && CF_ACCESS_TEAM_DOMAIN
    ? createRemoteJWKSet(new URL(`${CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`))
    : null;

const USER_ROLES = ['admin', 'worker', 'user'];
const HIRE_REQUEST_STATUSES = ['pending', 'assigned', 'completed', 'cancelled'];

const SALT_ROUNDS = 10;
const LEGACY_ADMIN_PASSWORDS = [];

async function hashPassword(value) {
  return bcrypt.hash(String(value), SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(String(plain), hash);
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function cleanRecord(value) {
  if (!value) {
    return null;
  }

  const source = typeof value.toObject === 'function' ? value.toObject() : { ...value };
  delete source._id;
  delete source.__v;
  // Tickets use address-only location
  if (source.ticketCode) {
    delete source.latitude;
    delete source.longitude;
  }
  return source;
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const safe = cleanRecord(user);
  delete safe.passwordHash;
  delete safe.tokenVersion;
  delete safe.firebaseUid;
  delete safe.firebaseProvider;
  delete safe.disabled;
  return safe;
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: Number(user.tokenVersion ?? 0),
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function parseNumericId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function accountWriteGuard(account) {
  const defaultTimestamp = account.$isDefault?.('updatedAt') || account.updatedAt === undefined;
  const guard = { id: account.id, updatedAt: defaultTimestamp ? { $exists: false } : account.updatedAt };
  const version = Number(account.tokenVersion ?? 0);
  if (version === 0) guard.$or = [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }];
  else guard.tokenVersion = version;
  return guard;
}

function nextAccountTimestamp(previous) {
  const timestamp = new Date(previous ?? 0).getTime();
  return new Date(Math.max(Date.now(), Number.isFinite(timestamp) ? timestamp + 1 : 0));
}

function buildSessionLabel(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'SESSION-LIVE';
  }

  const adminId = Number(payload.id);
  const issuedAt = Number(payload.iat);

  if (!Number.isFinite(adminId) || !Number.isFinite(issuedAt)) {
    return 'SESSION-LIVE';
  }

  return `SESSION-${adminId}-${issuedAt}`;
}

mongoose.set('strictQuery', true);

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, collection: 'counters' },
);

const userSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    gender: { type: String, required: true, enum: ['Female', 'Male', 'Other'] },
    mobile: { type: String, required: true, trim: true, maxlength: 15 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: USER_ROLES },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    profileImage: { type: String, default: null },
    firebaseUid: { type: String, unique: true, sparse: true },
    firebaseProvider: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    workerOnline: { type: Boolean, default: false },
    workerLastSeenAt: { type: Date, default: null },
    workerSkills: { type: [String], default: [] },
  },
  { versionKey: false, collection: 'users' },
);

// High-efficiency worker availability and heartbeat index
userSchema.index({ role: 1, workerOnline: 1, workerLastSeenAt: -1 });

const ticketStatusEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true, enum: TICKET_STATUSES },
    actorId: { type: Number, default: null },
    actorRole: { type: String, default: null },
    note: { type: String, default: null, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false, versionKey: false },
);

const ticketSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    ticketCode: { type: String, required: true, unique: true, trim: true },
    userId: { type: Number, required: true },
    workerId: { type: Number, default: null },
    wasteType: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    mediaData: { type: String, default: null },
    locationAddress: { type: String, required: true, trim: true },
    status: { type: String, required: true, enum: TICKET_STATUSES, default: 'pending' },
    priority: { type: String, required: true, enum: TICKET_PRIORITIES, default: 'medium' },
    statusHistory: { type: [ticketStatusEventSchema], default: [] },
    acceptedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    completionCode: { type: String, default: null },
    completionCodeHash: { type: String, default: null },
    completionMediaData: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'tickets' },
);

// Hot-path indexes: per-user lists, per-worker lists, status/priority filtering
ticketSchema.index({ userId: 1, updatedAt: -1 });
ticketSchema.index({ workerId: 1, updatedAt: -1 });
ticketSchema.index({ status: 1, priority: 1 });

const notificationSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: Number, default: null },
    targetRole: { type: String, enum: USER_ROLES, default: null },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    readBy: { type: [Number], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'notifications' },
);

notificationSchema.index({ userId: 1, targetRole: 1, createdAt: -1 });

const adminActivitySchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    adminId: { type: Number, required: true },
    adminName: { type: String, required: true, trim: true },
    sessionLabel: { type: String, default: null, trim: true },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, default: null, trim: true },
    targetId: { type: Number, default: null },
    summary: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'admin_activities' },
);

adminActivitySchema.index({ createdAt: -1 });

const hireRequestSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    requestCode: { type: String, required: true, unique: true, trim: true },
    userId: { type: Number, required: true },
    requesterName: { type: String, required: true, trim: true },
    requesterMobile: { type: String, required: true, trim: true },
    requesterEmail: { type: String, required: true, trim: true, lowercase: true },
    requesterAddress: { type: String, required: true, trim: true },
    title: { type: String, trim: true, default: 'Personal Work' },
    purpose: { type: String, required: true, trim: true },
    workAddress: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: HIRE_REQUEST_STATUSES,
      default: 'pending',
    },
    assignedWorkerId: { type: Number, default: null },
    assignedByAdminId: { type: Number, default: null },
    assignedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'hire_requests' },
);

hireRequestSchema.index({ status: 1, assignedWorkerId: 1 });
hireRequestSchema.index({ userId: 1, updatedAt: -1 });
hireRequestSchema.index(
  { assignedWorkerId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'assigned', assignedWorkerId: { $type: 'number' } },
  },
);

const adminSessionSchema = new mongoose.Schema(
  {
    sessionHash: { type: String, required: true, unique: true, index: true },
    csrfHash: { type: String, required: true },
    userId: { type: Number, required: true, index: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    zeroTrustSubject: { type: String, default: null },
    zeroTrustEmail: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false, collection: 'admin_sessions' },
);

adminSessionSchema.index({ sessionHash: 1, expiresAt: 1 });

// Email-verification-link policy: citizens are stored here (max 24h) until they
// click the Firebase verification link; the real account is created only then.
const PENDING_REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000;

const pendingRegistrationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    firebaseUid: { type: String, required: true, trim: true },
    firebaseProvider: { type: String, default: 'password' },
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    gender: { type: String, required: true, enum: ['Female', 'Male', 'Other'] },
    mobile: { type: String, required: true, trim: true, maxlength: 15 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    profileImage: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false, collection: 'pending_registrations' },
);

const deletedIdentitySchema = new mongoose.Schema(
  {
    emailHash: { type: String, required: true, unique: true },
    firebaseUidHash: { type: String, sparse: true },
    deletedAt: { type: Date, default: Date.now },
    deletedByAdminId: { type: Number, required: true },
  },
  { versionKey: false, collection: 'deleted_identities' },
);

const ticketMessageSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    ticketId: { type: Number, required: true, index: true },
    senderId: { type: Number, required: true },
    senderRole: { type: String, required: true, enum: USER_ROLES },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    readBy: { type: [Number], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'ticket_messages' },
);

// Chronological chat ordering index
ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

const reviewSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    ticketId: { type: Number, required: true, unique: true, index: true },
    userId: { type: Number, required: true, index: true },
    workerId: { type: Number, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'reviews' },
);

// Worker review aggregation index
reviewSchema.index({ workerId: 1, createdAt: -1 });

const workerLocationSchema = new mongoose.Schema(
  {
    workerId: { type: Number, required: true, unique: true, index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    updatedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false, collection: 'worker_locations' },
);

const Counter = mongoose.model('Counter', counterSchema);
const User = mongoose.model('User', userSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const AdminActivity = mongoose.model('AdminActivity', adminActivitySchema);
const HireRequest = mongoose.model('HireRequest', hireRequestSchema);
const AdminSession = mongoose.model('AdminSession', adminSessionSchema);
const PendingRegistration = mongoose.model('PendingRegistration', pendingRegistrationSchema);
const DeletedIdentity = mongoose.model('DeletedIdentity', deletedIdentitySchema);
const Review = mongoose.model('Review', reviewSchema);

// GPS and chat use one store selected before the server accepts traffic. We do
// not switch stores at runtime because doing so would split or hide data.
let locationConn = null;
let isLocationConnHealthy = false;
let auxiliaryStore = 'primary';
let d1CleanupTimer = null;
if (WORKER_LOCATION_MONGO_URI) {
  locationConn = mongoose.createConnection(WORKER_LOCATION_MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  locationConn.on('connected', () => {
    isLocationConnHealthy = true;
    console.log('[db] Secondary database connected successfully.');
  });
  locationConn.on('error', (err) => {
    isLocationConnHealthy = false;
    console.error('[db] Secondary database error:', err.message);
  });
  locationConn.on('disconnected', () => {
    isLocationConnHealthy = false;
    console.warn('[db] Secondary database disconnected.');
  });
}

const PrimaryWorkerLocation = mongoose.model('WorkerLocation', workerLocationSchema);
const SecondaryWorkerLocation = locationConn
  ? locationConn.model('WorkerLocation', workerLocationSchema)
  : null;

const PrimaryTicketMessage = mongoose.model('TicketMessage', ticketMessageSchema);
const SecondaryTicketMessage = locationConn
  ? locationConn.model('TicketMessage', ticketMessageSchema)
  : null;

function getActiveModel(d1Model, secondaryMongoModel, primaryModel) {
  if (auxiliaryStore === 'd1' && d1Model) {
    return d1Model;
  }
  if (auxiliaryStore === 'secondary' && secondaryMongoModel) {
    return secondaryMongoModel;
  }
  return primaryModel;
}

function selectAuxiliaryStore({
  d1Configured,
  d1Initialized,
  secondaryConfigured,
  secondaryReady,
}) {
  if (d1Configured) return d1Initialized ? 'd1' : null;
  if (secondaryConfigured) return secondaryReady ? 'secondary' : null;
  return 'primary';
}

const WorkerLocation = new Proxy(PrimaryWorkerLocation, {
  get(_target, prop) {
    const model = getActiveModel(D1WorkerLocation, SecondaryWorkerLocation, PrimaryWorkerLocation);
    const val = model[prop];
    return typeof val === 'function' ? val.bind(model) : val;
  },
  apply(_target, thisArg, argumentsList) {
    const model = getActiveModel(D1WorkerLocation, SecondaryWorkerLocation, PrimaryWorkerLocation);
    return Reflect.apply(model, thisArg, argumentsList);
  },
  construct(_target, argumentsList, newTarget) {
    const model = getActiveModel(D1WorkerLocation, SecondaryWorkerLocation, PrimaryWorkerLocation);
    return Reflect.construct(model, argumentsList, newTarget);
  },
});

const TicketMessage = new Proxy(PrimaryTicketMessage, {
  get(_target, prop) {
    const model = getActiveModel(D1TicketMessage, SecondaryTicketMessage, PrimaryTicketMessage);
    const val = model[prop];
    return typeof val === 'function' ? val.bind(model) : val;
  },
  apply(_target, thisArg, argumentsList) {
    const model = getActiveModel(D1TicketMessage, SecondaryTicketMessage, PrimaryTicketMessage);
    return Reflect.apply(model, thisArg, argumentsList);
  },
  construct(_target, argumentsList, newTarget) {
    const model = getActiveModel(D1TicketMessage, SecondaryTicketMessage, PrimaryTicketMessage);
    return Reflect.construct(model, argumentsList, newTarget);
  },
});

async function nextId(key) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return counter.value;
}

async function syncCounter(key, Model) {
  const highest = await Model.findOne({}, { id: 1 }).sort({ id: -1 }).lean();
  const highestId = highest?.id ?? 0;
  await Counter.findOneAndUpdate(
    { key },
    { $max: { value: highestId }, $setOnInsert: { key } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

async function createNotification({ userId = null, targetRole = null, title, message }) {
  const notification = await Notification.create({
    id: await nextId('notifications'),
    userId,
    targetRole,
    title,
    message,
    readBy: [],
    createdAt: new Date(),
  });

  return cleanRecord(notification);
}

async function createAdminActivity({
  adminUser,
  sessionLabel = null,
  action,
  targetType = null,
  targetId = null,
  summary,
  details = null,
}) {
  if (!adminUser || adminUser.role !== 'admin' || !action || !summary) {
    return null;
  }

  const adminName =
    `${adminUser.firstName ?? ''} ${adminUser.lastName ?? ''}`.trim() || `Admin #${adminUser.id}`;

  const activity = await AdminActivity.create({
    id: await nextId('adminActivities'),
    adminId: adminUser.id,
    adminName,
    sessionLabel: sessionLabel ? String(sessionLabel).trim() : null,
    action: String(action).trim(),
    targetType: targetType ? String(targetType).trim() : null,
    targetId: Number.isFinite(Number(targetId)) ? Number(targetId) : null,
    summary: String(summary).trim(),
    createdAt: new Date(),
  });

  await createAccountActivity({ actor: adminUser, action, targetType, targetId, summary, details });

  return cleanRecord(activity);
}

async function createAccountActivity({ actor, action, targetType = null, targetId = null, summary, details = null }) {
  if (!actor || !USER_ROLES.includes(actor.role)) return null;
  const actorName = `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() || `${actor.role} #${actor.id}`;
  return AccountActivity.create({
    id: await nextId('accountActivities'),
    actorId: actor.id,
    actorRole: actor.role,
    actorName,
    actorEmail: normalizeEmail(actor.email),
    action,
    targetType,
    targetId: targetId === null ? null : parseNumericId(targetId),
    summary,
    details,
    createdAt: new Date(),
  });
}

async function ticketActivityDetails(ticket) {
  const participants = await User.find({ id: { $in: [ticket.userId, ticket.workerId].filter(Boolean) } }, {
    id: 1, firstName: 1, lastName: 1, email: 1, role: 1, mobile: 1, address: 1,
  }).lean();
  return {
    ...ticketActivitySnapshot(ticket),
    requester: accountActivitySnapshot(participants.find((user) => user.id === ticket.userId)),
    worker: accountActivitySnapshot(participants.find((user) => user.id === ticket.workerId)),
  };
}

function truncateText(value, maxLength = 140) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function cleanBoundedText(value, maxLength = MAX_TICKET_TEXT_LENGTH) {
  const text = String(value ?? '').trim();
  return text && text.length <= maxLength ? text : null;
}

function firebaseIdentity(decoded) {
  return {
    uid: String(decoded?.uid ?? decoded?.sub ?? '').trim(),
    provider: String(decoded?.firebase?.sign_in_provider ?? '').trim() || null,
  };
}

function deletedIdentityFilter(email, uid = '') {
  const filters = [{ emailHash: hashAdminSecret(normalizeEmail(email)) }];
  if (uid) filters.push({ firebaseUidHash: hashAdminSecret(uid) });
  return { $or: filters };
}

function normalizeAccountProfile({ firstName, lastName, gender, mobile, address }) {
  const allowedGenders = ['Female', 'Male', 'Other'];
  const normalizedGender = allowedGenders.find(
    (item) => item.toLowerCase() === String(gender ?? '').trim().toLowerCase(),
  );
  const profile = {
    firstName: cleanBoundedText(firstName, 100),
    lastName: cleanBoundedText(lastName, 100),
    gender: normalizedGender ?? null,
    mobile: cleanBoundedText(mobile, 15),
    address: cleanBoundedText(address, 500),
  };
  if (
    Object.values(profile).some((value) => !value) ||
    !/^\d{10,15}$/.test(profile.mobile)
  ) {
    return null;
  }
  return profile;
}

function publicWorkerProfile(user) {
  if (!user) return null;
  return {
    id: Number(user.id),
    firstName: String(user.firstName ?? ''),
    lastName: String(user.lastName ?? ''),
    role: 'worker',
    ratingAverage: Number(user.ratingAverage ?? 0),
    ratingCount: Number(user.ratingCount ?? 0),
  };
}

async function firebaseRecordForUser(user) {
  if (!user || !isFirebaseEnabled()) return null;
  if (user.firebaseUid) {
    const byUid = await getFirebaseUserByUid(user.firebaseUid);
    if (byUid) return byUid;
  }
  return getFirebaseUserByEmail(user.email);
}

function firebaseProviderFromRecord(record) {
  return record?.providerData?.[0]?.providerId ?? null;
}

function isValidProfileImage(value) {
  if (value === null || value === undefined || value === '') return true;
  const text = String(value);
  return (
    isValidImageData(text) ||
    (text.length <= 2_000 && /^https:\/\/[a-z0-9.-]*googleusercontent\.com\//i.test(text))
  );
}

function appendTicketStatus(ticket, status, actor, note = null, at = new Date()) {
  ticket.status = status;
  ticket.updatedAt = at;
  ticket.statusHistory.push({
    status,
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? null,
    note: note ? String(note).trim().slice(0, 500) : null,
    createdAt: at,
  });
}

function canAccessTicket(user, ticket) {
  return Boolean(
    user &&
      ticket &&
      (user.role === 'admin' ||
        ticket.userId === user.id ||
        (user.role === 'worker' && ticket.workerId === user.id)),
  );
}

async function buildTicketRecords(rows, viewer = null) {
  const ticketIds = rows.map((ticket) => Number(ticket.id));
  const userIds = [
    ...new Set(
      rows
        .flatMap((ticket) => [Number(ticket.userId), Number(ticket.workerId)])
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  const [users, reviews] = await Promise.all([
    userIds.length
      ? User.find({ id: { $in: userIds } }, { passwordHash: 0, profileImage: 0 }).lean()
      : [],
    ticketIds.length ? Review.find({ ticketId: { $in: ticketIds } }).lean() : [],
  ]);
  const userMap = new Map(users.map((user) => [Number(user.id), user]));
  const reviewMap = new Map(reviews.map((review) => [Number(review.ticketId), cleanRecord(review)]));

  return rows.map((ticket) => {
    const record = cleanRecord(ticket);
    delete record.completionCodeHash;
    if (viewer?.role !== 'admin' && (viewer?.role !== 'user' || viewer.id !== record.userId)) {
      delete record.completionCode;
    }
    const slaDueAt = new Date(
      new Date(record.createdAt).getTime() + ticketSlaHours(record.priority) * 60 * 60 * 1000,
    );
    const requester = userMap.get(Number(record.userId)) ?? null;
    const worker = userMap.get(Number(record.workerId)) ?? null;
    return {
      ...record,
      slaDueAt,
      slaOverdue: !isClosedTicket(record.status) && slaDueAt.getTime() < Date.now(),
      requester: requester ? sanitizeUser(requester) : null,
      assignedWorker:
        viewer?.role === 'admin' || viewer?.id === worker?.id
          ? sanitizeUser(worker)
          : publicWorkerProfile(worker),
      review: reviewMap.get(Number(record.id)) ?? null,
    };
  });
}

function buildTicketDetailsMessage(ticket, requester) {
  const parts = [];

  const ticketCode = String(ticket?.ticketCode ?? '').trim();
  if (ticketCode) {
    parts.push(ticketCode);
  }

  const wasteType = String(ticket?.wasteType ?? '').trim();
  if (wasteType) {
    parts.push(`Waste: ${wasteType}`);
  }

  const description = truncateText(ticket?.description, 160);
  if (description) {
    parts.push(`Issue: ${description}`);
  }

  const location = truncateText(ticket?.locationAddress, 160);
  if (location) {
    parts.push(`Location: ${location}`);
  }

  if (ticket?.mediaData) {
    parts.push('Attachment: yes');
  }

  if (requester) {
    const name = `${requester.firstName ?? ''} ${requester.lastName ?? ''}`.trim();
    const mobile = String(requester.mobile ?? '').trim();
    const email = String(requester.email ?? '').trim();
    const contact = [mobile, email].filter(Boolean).join(', ');
    const label =
      name || (Number.isFinite(Number(requester.id)) ? `User #${requester.id}` : 'User');

    parts.push(contact ? `User: ${label} (${contact})` : `User: ${label}`);

    const requesterAddress = truncateText(requester.address, 160);
    if (
      requesterAddress &&
      (!location || requesterAddress.toLowerCase() !== String(location).toLowerCase())
    ) {
      parts.push(`User Address: ${requesterAddress}`);
    }
  }

  return parts.join(' | ');
}

async function getBusyWorkerIds() {
  const rows = await HireRequest.find(
    { status: 'assigned', assignedWorkerId: { $ne: null } },
    { assignedWorkerId: 1 },
  ).lean();

  return new Set(
    rows
      .map((row) => Number(row.assignedWorkerId))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
}

async function pickFreeWorkerIdForTicket(wasteType = '') {
  let workers = fastCache.get('workers:online');
  if (!workers) {
    workers = await User.find(
      {
        role: 'worker',
        workerOnline: true,
        workerLastSeenAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) },
      },
      { id: 1, workerSkills: 1 },
    ).lean();
    fastCache.set('workers:online', workers, 5000);
  }
  const normalizedWasteType = String(wasteType).trim().toLowerCase();
  const skilledWorkers = workers.filter((worker) => {
    const skills = Array.isArray(worker.workerSkills) ? worker.workerSkills : [];
    return skills.some((skill) => normalizedWasteType.includes(String(skill).toLowerCase()));
  });
  const generalWorkers = workers.filter(
    (worker) => !Array.isArray(worker.workerSkills) || worker.workerSkills.length === 0,
  );
  const candidates = normalizedWasteType && skilledWorkers.length
    ? skilledWorkers
    : generalWorkers.length
      ? generalWorkers
      : workers;
  const workerIds = candidates
    .map((worker) => Number(worker.id))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!workerIds.length) {
    return null;
  }

  const busy = await getBusyWorkerIds();
  const freeIds = workerIds.filter((id) => !busy.has(id));
  if (!freeIds.length) {
    return null;
  }

  const counts = await Ticket.aggregate([
    {
      $match: {
        workerId: { $in: freeIds },
        status: { $nin: ['completed', 'cancelled'] },
      },
    },
    { $group: { _id: '$workerId', count: { $sum: 1 } } },
  ]);

  const countMap = new Map(
    counts
      .map((row) => [Number(row._id), Number(row.count)])
      .filter(([id, count]) => Number.isFinite(id) && Number.isFinite(count)),
  );

  let selected = freeIds[0];
  let selectedCount = countMap.get(selected) ?? 0;

  for (const id of freeIds) {
    const value = countMap.get(id) ?? 0;
    if (value < selectedCount || (value === selectedCount && id < selected)) {
      selected = id;
      selectedCount = value;
    }
  }

  return selected;
}

async function autoAssignUnassignedTickets(limit = 25) {
  const busy = await getBusyWorkerIds();
  let workers = fastCache.get('workers:online');
  if (!workers) {
    workers = await User.find(
      {
        role: 'worker',
        workerOnline: true,
        workerLastSeenAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) },
      },
      { id: 1, workerSkills: 1 },
    ).lean();
    fastCache.set('workers:online', workers, 5000);
  }
  const freeWorkers = workers
    .map((w) => ({
      id: Number(w.id),
      skills: Array.isArray(w.workerSkills)
        ? w.workerSkills.map((s) => String(s).toLowerCase().trim())
        : [],
    }))
    .filter((w) => Number.isFinite(w.id) && w.id > 0 && !busy.has(w.id));

  if (!freeWorkers.length) {
    return 0;
  }

  const freeIds = freeWorkers.map((w) => w.id);
  const tickets = await Ticket.find({
    workerId: null,
    status: { $nin: ['completed', 'cancelled'] },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  if (!tickets.length) {
    return 0;
  }

  const counts = await Ticket.aggregate([
    {
      $match: {
        workerId: { $in: freeIds },
        status: { $nin: ['completed', 'cancelled'] },
      },
    },
    { $group: { _id: '$workerId', count: { $sum: 1 } } },
  ]);

  const workloadMap = new Map(freeIds.map((id) => [id, 0]));
  counts.forEach((row) => {
    const id = Number(row._id);
    if (workloadMap.has(id)) workloadMap.set(id, Number(row.count) || 0);
  });

  const requesterIds = [
    ...new Set(
      tickets
        .map((ticket) => Number(ticket.userId))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  ];

  const requesters = requesterIds.length
    ? await User.find({ id: { $in: requesterIds } }, { passwordHash: 0 }).lean()
    : [];
  const requesterMap = new Map(requesters.map((user) => [Number(user.id), user]));

  let assigned = 0;
  for (const ticket of tickets) {
    const wasteType = String(ticket.wasteType ?? '').toLowerCase().trim();
    const skilled = freeWorkers.filter((w) => w.skills.includes(wasteType));
    const pool = skilled.length ? skilled : freeWorkers;

    let selectedWorkerId = null;
    let minLoad = Infinity;
    for (const w of pool) {
      const load = workloadMap.get(w.id) ?? 0;
      if (load < minLoad || (load === minLoad && selectedWorkerId !== null && w.id < selectedWorkerId)) {
        minLoad = load;
        selectedWorkerId = w.id;
      }
    }

    if (!selectedWorkerId) {
      break;
    }

    const updated = await Ticket.findOneAndUpdate(
      { id: ticket.id, workerId: null, status: { $nin: ['completed', 'cancelled'] } },
      {
        $set: { workerId: selectedWorkerId, status: 'assigned', updatedAt: new Date() },
        $push: {
          statusHistory: {
            status: 'assigned',
            actorId: null,
            actorRole: 'system',
            note: `Automatically assigned to Worker #${selectedWorkerId}.`,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    );

    if (updated) {
      assigned += 1;
      workloadMap.set(selectedWorkerId, minLoad + 1);
      const requester = requesterMap.get(Number(updated.userId));
      await createNotification({
        userId: selectedWorkerId,
        title: 'New Ticket Assigned',
        message: buildTicketDetailsMessage(updated, requester),
      });
    }
  }

  return assigned;
}

async function ensureSeedAdmin() {
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    return null;
  }

  if (!isStrongPassword(SEED_ADMIN_PASSWORD)) {
    throw new Error(`SEED_ADMIN_PASSWORD is invalid. ${PASSWORD_POLICY_MESSAGE}`);
  }

  const existing = await User.findOne({ email: SEED_ADMIN_EMAIL });
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error('SEED_ADMIN_EMAIL already belongs to a non-admin account.');
    }
    return existing;
  }

  const now = new Date();
  return User.create({
    id: await nextId('users'),
    firstName: 'System',
    lastName: 'Admin',
    gender: 'Other',
    mobile: '0000000000',
    email: SEED_ADMIN_EMAIL,
    passwordHash: await hashPassword(SEED_ADMIN_PASSWORD),
    role: 'admin',
    address: 'Administration',
    profileImage: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  });
}

async function purgeDemoAccounts() {
  const demoEmails = [
    'admin@smartwaste.com',
    'worker@smartwaste.com',
    'user@smartwaste.com',
  ];
  const demoUsers = await User.find({ email: { $in: demoEmails } });
  if (demoUsers.length > 0) {
    const demoIds = demoUsers.map((u) => u.id);
    await Promise.all([
      User.deleteMany({ id: { $in: demoIds } }),
      Notification.deleteMany({ userId: { $in: demoIds } }),
      Ticket.deleteMany({ userId: { $in: demoIds } }),
      HireRequest.deleteMany({ userId: { $in: demoIds } }),
    ]);
  }
}

async function seedData() {
  await purgeDemoAccounts();

  const userCount = await User.countDocuments();
  if (userCount > 0) {
    await syncCounter('users', User);
    if (ADMIN_AUTH_ENABLED) {
      await ensureSeedAdmin();
    }
    await Promise.all([
      syncCounter('tickets', Ticket),
      syncCounter('hireRequests', HireRequest),
      syncCounter('notifications', Notification),
      syncCounter('adminActivities', AdminActivity),
      syncCounter('accountActivities', AccountActivity),
      syncCounter('ticketMessages', TicketMessage),
      syncCounter('reviews', Review),
    ]);
    return;
  }

  if (ADMIN_AUTH_ENABLED) {
    await ensureSeedAdmin();
  }

  await syncCounter('users', User);
}

async function migrateTicketLifecycle() {
  if (!PUBLIC_AUTH_ENABLED) return;
  const now = new Date();
  await Ticket.updateMany(
    { workerId: { $ne: null }, status: 'pending' },
    {
      $set: { status: 'assigned', updatedAt: now },
      $push: {
        statusHistory: {
          status: 'assigned',
          actorId: null,
          actorRole: 'system',
          note: 'Existing assignment migrated to tracked lifecycle.',
          createdAt: now,
        },
      },
    },
  );

  const activeTickets = await Ticket.find({
    status: 'in_progress',
    completionCodeHash: null,
  });
  for (const ticket of activeTickets) {
    const completionCode = createCompletionCode();
    ticket.completionCode = completionCode;
    ticket.completionCodeHash = hashAdminSecret(completionCode);
    if (!ticket.startedAt) ticket.startedAt = ticket.updatedAt ?? now;
    await ticket.save();
    await createNotification({
      userId: ticket.userId,
      title: 'Completion Code Ready',
      message: `${ticket.ticketCode} completion code: ${completionCode}. Share it only after verifying the work.`,
    });
  }
}

const app = express();
if (IS_PRODUCTION) {
  app.set('trust proxy', 1);
}
app.use(helmet());

if (IS_PRODUCTION && ADMIN_AUTH_ENABLED && REQUIRE_CF_ACCESS) {
  app.use(async (req, res, next) => {
    if (req.method === 'OPTIONS' || ['/api/health', '/api/ready'].includes(req.path)) {
      return next();
    }

    const assertion = req.get('Cf-Access-Jwt-Assertion');
    if (!assertion || !cloudflareJwks) {
      return res.status(403).json({ message: 'Zero Trust access is required.' });
    }

    try {
      const { payload } = await jwtVerify(assertion, cloudflareJwks, {
        audience: CF_ACCESS_AUD,
        issuer: CF_ACCESS_TEAM_DOMAIN,
      });
      req.zeroTrustIdentity = {
        subject: String(payload.sub ?? ''),
        email: String(payload.email ?? ''),
      };
      return next();
    } catch {
      return res.status(403).json({ message: 'Invalid Zero Trust assertion.' });
    }
  });
}

const allowedOrigins = new Set(
  [
    PUBLIC_AUTH_ENABLED ? process.env.PUBLIC_FRONTEND_URL : null,
    PUBLIC_AUTH_ENABLED ? process.env.WORKER_FRONTEND_URL : null,
    ADMIN_AUTH_ENABLED ? process.env.ADMIN_FRONTEND_URL : null,
  ]
    .flatMap((value) => String(value ?? '').split(','))
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean),
);
if (!IS_PRODUCTION) {
  allowedOrigins.add('http://localhost:4200');
  allowedOrigins.add('http://localhost:4300');
  allowedOrigins.add('http://localhost:4400');
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalized = String(origin).trim().replace(/\/$/, '');
  if (allowedOrigins.has(normalized)) return true;
  if (!IS_PRODUCTION && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
    return true;
  }
  return false;
}

app.use((req, res, next) => {
  const origin = String(req.headers.origin ?? '').replace(/\/$/, '');
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ message: 'Origin is not allowed.' });
  }
  return next();
});
app.use((req, res, next) => {
  if (!ADMIN_EDGE_SECRET_HASH || !ADMIN_AUTH_ENABLED || !IS_PRODUCTION) {
    return next();
  }
  if (['/api/health', '/api/ready'].includes(req.path)) {
    return next();
  }
  if (!matchesAdminSecret(req.get('X-Admin-Edge') ?? '', ADMIN_EDGE_SECRET_HASH)) {
    return res.status(404).json({ message: 'Not found.' });
  }
  return next();
});
app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Admin-CSRF'],
  }),
);

function authClientIp(req) {
  const rawIp =
    (IS_PRODUCTION ? String(req.get('CF-Connecting-IP') ?? '').trim() : '') ||
    req.ip ||
    '127.0.0.1';
  return ipKeyGenerator(rawIp);
}

const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  keyGenerator: authClientIp,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts from this network. Try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const clientIp = authClientIp(req);
    return email ? `${email}:${clientIp}` : clientIp;
  },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again in a moment.' },
});

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const clientIp = authClientIp(req);
    return email ? `${email}:${clientIp}` : clientIp;
  },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many admin login attempts. Please wait a moment and try again.' },
});

const ticketCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many tickets created. Try again later.' },
});

const ticketMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => {
    const userId = req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip || '127.0.0.1');
    return `ticket_msg:${userId}`;
  },
  validate: { ip: false, keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many messages sent. Please slow down.' },
});

app.use(express.json({ limit: '3mb' }));
app.use('/api/auth', (req, res, next) => {
  if (!ADMIN_AUTH_ENABLED && req.path === '/admin-login') {
    return res.status(404).json({ message: 'Not found.' });
  }
  if (!PUBLIC_AUTH_ENABLED && !['/admin-login', '/logout'].includes(req.path)) {
    return res.status(404).json({ message: 'Not found.' });
  }
  return next();
});
app.use('/api/auth', authIpLimiter);
app.use('/api/auth/admin-login', adminAuthLimiter);
app.use('/api/auth', (req, res, next) => {
  if (req.path === '/admin-login') return next();
  return authLimiter(req, res, next);
});

function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'none' : 'lax',
    path: '/',
  };
}

function clearAdminCookie(res) {
  res.clearCookie(ADMIN_SESSION_COOKIE, adminCookieOptions());
}

async function authenticateAdminSession(req, res) {
  if (!ADMIN_AUTH_ENABLED) {
    return false;
  }

  const rawSession = readCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  if (!rawSession) {
    return false;
  }

  const session = await AdminSession.findOne({
    sessionHash: hashAdminSecret(rawSession),
    expiresAt: { $gt: new Date() },
  });
  if (!session) {
    clearAdminCookie(res);
    return false;
  }

  const user = await User.findOne({ id: session.userId, role: 'admin' }).lean();
  if (!user || user.disabled) {
    await AdminSession.deleteOne({ _id: session._id });
    clearAdminCookie(res);
    return false;
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const csrfToken = req.get('X-Admin-CSRF');
    if (!csrfToken || !matchesAdminSecret(csrfToken, session.csrfHash)) {
      res.status(403).json({ message: 'Invalid admin CSRF token.' });
      return null;
    }
  }

  req.user = sanitizeUser(user);
  req.adminSessionId = session._id;
  req.sessionLabel = `ADMIN-SESSION-${String(session._id).slice(-8)}`;
  return true;
}

async function authMiddleware(req, res, next) {
  const adminResult = await authenticateAdminSession(req, res);
  if (adminResult === true) {
    return next();
  }
  if (adminResult === null) {
    return undefined;
  }

  if (!PUBLIC_AUTH_ENABLED) {
    return res.status(401).json({ message: 'Admin session required.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing auth token' });
  }

  try {
    const token = authHeader.slice('Bearer '.length);
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ id: payload.id }).lean();

    if (!user || user.disabled) {
      return res.status(401).json({ message: 'Invalid auth token' });
    }

    if (!tokenVersionMatches(payload, user)) {
      return res.status(401).json({ message: 'Invalid auth token' });
    }

    if (user.role === 'admin') {
      return res.status(401).json({ message: 'Admin session required.' });
    }

    req.user = sanitizeUser(user);
    req.sessionLabel = buildSessionLabel(payload);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid auth token' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    return next();
  };
}

async function sendLoginResponse(user, res) {
  user.lastLoginAt = new Date();
  await user.save();
  await createAccountActivity({
    actor: user,
    action: user.role === 'worker' ? 'Worker Login' : 'User Login',
    targetType: 'session',
    targetId: user.id,
    summary: `Signed in to the ${user.role === 'worker' ? 'Worker Console' : 'citizen portal'}.`,
    details: accountActivitySnapshot(user),
  });

  clearAdminCookie(res);
  const token = generateToken(user);
  return res.json({ token, user: sanitizeUser(user) });
}

async function handlePasswordLogin(req, res, portal) {
  const { email, password } = req.body ?? {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  if (portal === 'public' && isFirebaseEnabled()) {
    try {
      if (await getFirebaseUserByEmail(normalizedEmail)) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }
    } catch {
      return res.status(503).json({ message: 'Authentication service is temporarily unavailable.' });
    }
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.disabled || !(await comparePassword(String(password), user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  if (!canUseLoginPortal(user.role, portal)) {
    const message =
      portal === 'admin'
        ? 'Admin access is required.'
        : portal === 'worker'
          ? 'Worker access is required.'
          : user.role === 'admin'
            ? 'Admin accounts must use the Admin Console.'
            : 'Worker accounts must use the Worker Console.';
    return res.status(403).json({ message });
  }

  return sendLoginResponse(user, res);
}

async function handleAdminLogin(req, res) {
  const { email, password } = req.body ?? {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  if (
    REQUIRE_CF_ACCESS &&
    normalizeEmail(req.zeroTrustIdentity?.email) !== normalizedEmail
  ) {
    return res.status(403).json({ message: 'Admin identity does not match Zero Trust identity.' });
  }

  const user = await User.findOne({ email: normalizedEmail });
  const passwordValid = user
    ? await comparePassword(String(password), user.passwordHash)
    : false;
  if (!user || user.disabled || user.role !== 'admin' || !passwordValid) {
    return res.status(401).json({ message: 'Invalid admin credentials.' });
  }

  if (LEGACY_ADMIN_PASSWORDS.includes(String(password))) {
    return res.status(403).json({
      message: 'This legacy password is disabled. Set a unique admin password and restart once.',
    });
  }

  const sessionToken = createAdminSecret();
  const csrfToken = createAdminSecret();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);

  // Hard-security default: a new admin login revokes all previous sessions.
  await AdminSession.deleteMany({ userId: user.id });
  const session = await AdminSession.create({
    sessionHash: hashAdminSecret(sessionToken),
    csrfHash: hashAdminSecret(csrfToken),
    userId: user.id,
    ip: req.ip ?? null,
    userAgent: String(req.get('user-agent') ?? '').slice(0, 500) || null,
    zeroTrustSubject: req.zeroTrustIdentity?.subject || null,
    zeroTrustEmail: req.zeroTrustIdentity?.email || null,
    createdAt: new Date(),
    expiresAt,
  });

  user.lastLoginAt = new Date();
  await user.save();

  res.cookie(ADMIN_SESSION_COOKIE, sessionToken, {
    ...adminCookieOptions(),
    maxAge: ADMIN_SESSION_TTL_MS,
  });

  await createAdminActivity({
    adminUser: user,
    sessionLabel: `ADMIN-SESSION-${String(session._id).slice(-8)}`,
    action: 'Admin Login',
    targetType: 'session',
    summary: 'Signed in to the private Smart Waste admin portal.',
  });

  return res.json({ user: sanitizeUser(user), csrfToken, expiresAt });
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
  });
});

app.get('/api/ready', (_req, res) => {
  const primaryConnected = mongoose.connection.readyState === 1;
  const auxiliaryConnected =
    auxiliaryStore === 'd1'
      ? isD1Ready()
      : auxiliaryStore === 'secondary'
        ? Boolean(isLocationConnHealthy && locationConn?.readyState === 1)
        : primaryConnected;
  const connected = primaryConnected && auxiliaryConnected;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ready' : 'unavailable',
    time: new Date().toISOString(),
    databases: {
      primary: primaryConnected ? 'connected' : 'disconnected',
      auxiliary: {
        store: auxiliaryStore,
        status: auxiliaryConnected ? 'connected' : 'disconnected',
      },
    },
  });
});

// Email-verification-link policy: signup stores a pending registration only.
// The real citizen account is created by /api/auth/complete-signup after the
// user clicks the Firebase verification link. Existing users are grandfathered.
app.post('/api/auth/signup', async (req, res) => {
  const {
    idToken,
    firstName,
    lastName,
    gender = 'Other',
    mobile,
    address,
    profileImage = null,
  } = req.body ?? {};

  if (!idToken) {
    return res.status(400).json({ message: 'Please fill all mandatory fields.' });
  }

  if (!isFirebaseEnabled()) {
    return res.status(500).json({ message: 'Email verification is not configured yet.' });
  }

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(String(idToken));
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session. Please try again.' });
  }

  const normalizedEmail = normalizeEmail(decoded.email);
  const identity = firebaseIdentity(decoded);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }
  if (!identity.uid) {
    return res.status(400).json({ message: 'Firebase identity is missing.' });
  }
  if (
    await DeletedIdentity.exists(deletedIdentityFilter(normalizedEmail, identity.uid))
  ) {
    return res.status(403).json({ message: 'This account is disabled. Contact an administrator.' });
  }

  const profile = normalizeAccountProfile({ firstName, lastName, gender, mobile, address });
  if (!profile) {
    return res.status(400).json({ message: 'Profile fields are invalid or too long.' });
  }
  if (!isValidProfileImage(profileImage)) {
    return res.status(400).json({ message: 'Profile image must be a JPEG, PNG, or WebP under 2 MB.' });
  }

  const existing = await User.findOne(
    { $or: [{ email: normalizedEmail }, { firebaseUid: identity.uid }] },
    { id: 1 },
  ).lean();
  if (existing) {
    return res.status(409).json({ message: 'Email already registered.' });
  }

  const storedProfileImage = profileImage || null;
  const now = new Date();
  await PendingRegistration.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        firebaseUid: identity.uid,
        firebaseProvider: identity.provider,
        ...profile,
        profileImage: storedProfileImage,
        createdAt: now,
        expiresAt: new Date(now.getTime() + PENDING_REGISTRATION_TTL_MS),
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  return res.status(202).json({ pending: true });
});

// Called after the citizen clicks the Firebase verification link.
app.post('/api/auth/complete-signup', async (req, res) => {
  const { idToken } = req.body ?? {};
  if (!idToken) {
    return res.status(400).json({ message: 'Firebase ID token is required.' });
  }

  if (!isFirebaseEnabled()) {
    return res.status(500).json({ message: 'Email verification is not configured yet.' });
  }

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(String(idToken));
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session. Please try again.' });
  }

  const email = normalizeEmail(decoded.email);
  const identity = firebaseIdentity(decoded);
  if (!identity.uid) {
    return res.status(400).json({ message: 'Firebase identity is missing.' });
  }
  if (decoded.email_verified !== true) {
    return res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Email not verified yet. Click the verification link in your inbox first.',
    });
  }

  if (await DeletedIdentity.exists(deletedIdentityFilter(email, identity.uid))) {
    return res.status(403).json({ message: 'This account is disabled. Contact an administrator.' });
  }

  const existing = await User.findOne({
    $or: [{ email }, { firebaseUid: identity.uid }],
  });
  if (existing) {
    if (existing.disabled) {
      return res.status(403).json({ message: 'This account is disabled. Contact an administrator.' });
    }
    if (existing.firebaseUid && existing.firebaseUid !== identity.uid) {
      return res.status(409).json({ message: 'Email is linked to another identity.' });
    }
    if (!canUseLoginPortal(existing.role, 'public')) {
      return res.status(403).json({
        message:
          existing.role === 'admin'
            ? 'Admin accounts must use the Admin Console.'
            : 'Worker accounts must use the Worker Console.',
      });
    }
    if (!existing.firebaseUid) {
      existing.firebaseUid = identity.uid;
      existing.firebaseProvider = identity.provider;
    }
    return sendLoginResponse(existing, res);
  }

  const pending = await PendingRegistration.findOne({
    email,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!pending) {
    return res.status(410).json({ message: 'Registration expired. Please sign up again.' });
  }
  if (pending.firebaseUid && pending.firebaseUid !== identity.uid) {
    return res.status(409).json({ message: 'Registration belongs to another identity.' });
  }

  const now = new Date();
  const storedProfileImage = pending.profileImage
    ? await uploadMedia(pending.profileImage, 'profiles')
    : null;
  const uploadedProfileImage = storedProfileImage !== pending.profileImage;
  let user;
  try {
    user = await User.create({
      id: await nextId('users'),
      firstName: pending.firstName,
      lastName: pending.lastName,
      gender: pending.gender,
      mobile: pending.mobile,
      email,
      passwordHash: await hashPassword(createAdminSecret()),
      role: 'user',
      address: pending.address,
      profileImage: storedProfileImage,
      firebaseUid: identity.uid,
      firebaseProvider: identity.provider,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    });
  } catch (err) {
    if (err?.code === 11000) {
      user = await User.findOne({ email });
      if (user) {
        if (uploadedProfileImage) await deleteMedia(storedProfileImage).catch(() => undefined);
        await PendingRegistration.deleteOne({ email });
        return sendLoginResponse(user, res);
      }
    }
    if (uploadedProfileImage) await deleteMedia(storedProfileImage).catch(() => undefined);
    throw err;
  }

  await PendingRegistration.deleteOne({ email });

  await createNotification({
    userId: user.id,
    title: 'Account Created',
    message: 'Welcome to Smart Waste Management System.',
  });

  return sendLoginResponse(user, res);
});

app.post('/api/auth/login', async (req, res) => {
  return handlePasswordLogin(req, res, 'public');
});

app.post('/api/auth/admin-login', async (req, res) => {
  return handleAdminLogin(req, res);
});

app.post('/api/auth/worker-login', async (req, res) => {
  return handlePasswordLogin(req, res, 'worker');
});

app.post('/api/auth/firebase-login', async (req, res) => {
  const {
    idToken,
    firstName,
    lastName,
    gender = 'Other',
    mobile = '0000000000',
    address = 'Firebase Auth User',
    profileImage = null,
  } = req.body ?? {};

  if (!idToken) {
    return res.status(400).json({ message: 'Firebase ID token is required.' });
  }

  if (!isFirebaseEnabled()) {
    return res.status(500).json({
      message:
        'Firebase Admin is not configured. Add backend/firebase-service-account.json.',
    });
  }

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(String(idToken));
  } catch {
    return res.status(401).json({ message: 'Invalid Firebase token.' });
  }

  const email = normalizeEmail(decoded.email);
  const identity = firebaseIdentity(decoded);
  if (!email) {
    return res.status(400).json({ message: 'No email found in Firebase token.' });
  }
  if (!identity.uid) {
    return res.status(400).json({ message: 'Firebase identity is missing.' });
  }
  if (await DeletedIdentity.exists(deletedIdentityFilter(email, identity.uid))) {
    return res.status(403).json({ message: 'This account is disabled. Contact an administrator.' });
  }

  // Email-verification policy: password-provider logins must have a verified
  // email. Google tokens already carry email_verified=true from Google.
  const passwordProvider = usesFirebasePasswordProvider(decoded);
  if (passwordProvider && decoded.email_verified !== true) {
    return res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email before signing in. Check your inbox for the verification link.',
    });
  }

  let user = await User.findOne({ firebaseUid: identity.uid });
  if (!user) user = await User.findOne({ email });
  if (user?.disabled) {
    return res.status(403).json({ message: 'This account is disabled. Contact an administrator.' });
  }
  if (user?.firebaseUid && user.firebaseUid !== identity.uid) {
    return res.status(409).json({ message: 'Email is linked to another identity.' });
  }
  if (user && !canUseLoginPortal(user.role, 'public')) {
    return res.status(403).json({
      message:
        user.role === 'admin'
          ? 'Admin accounts must use the Admin Console.'
          : 'Worker accounts must use the Worker Console.',
    });
  }

  if (!user) {
    // Prefer the profile captured at signup time over generic defaults.
    const pending = await PendingRegistration.findOne({
      email,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (passwordProvider && !pending) {
      return res.status(410).json({ message: 'Registration expired. Please sign up again.' });
    }
    const now = new Date();
    const fullName = String(decoded.name ?? '').trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const derivedFirstName = nameParts[0] ?? 'Firebase';
    const derivedLastName = nameParts.slice(1).join(' ') || 'User';
    if (pending?.firebaseUid && pending.firebaseUid !== identity.uid) {
      return res.status(409).json({ message: 'Registration belongs to another identity.' });
    }
    const profile = normalizeAccountProfile({
      firstName: pending?.firstName ?? firstName ?? derivedFirstName,
      lastName: pending?.lastName ?? lastName ?? derivedLastName,
      gender: pending?.gender ?? gender,
      mobile: pending?.mobile ?? mobile,
      address: pending?.address ?? address,
    });
    const nextProfileImage = profileImage ?? pending?.profileImage ?? decoded.picture ?? null;
    if (!profile || !isValidProfileImage(nextProfileImage)) {
      return res.status(400).json({ message: 'Firebase profile fields are invalid or too long.' });
    }
    const storedProfileImage = nextProfileImage
      ? await uploadMedia(nextProfileImage, 'profiles')
      : null;
    const uploadedProfileImage = storedProfileImage !== nextProfileImage;

    let createdNewUser = false;
    try {
      user = await User.create({
        id: await nextId('users'),
        ...profile,
        email,
        passwordHash: await hashPassword(createAdminSecret()),
        role: 'user',
        profileImage: storedProfileImage,
        firebaseUid: identity.uid,
        firebaseProvider: identity.provider,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      });
      createdNewUser = true;
    } catch (error) {
      if (uploadedProfileImage) await deleteMedia(storedProfileImage).catch(() => undefined);
      if (error?.code === 11000) {
        user = await User.findOne({ $or: [{ email }, { firebaseUid: identity.uid }] });
      }
      if (!user) throw error;
    }
    if (user.disabled) {
      return res.status(403).json({ message: 'This account is disabled. Contact an administrator.' });
    }
    if (!canUseLoginPortal(user.role, 'public')) {
      return res.status(403).json({ message: 'This account must use its assigned staff console.' });
    }

    await PendingRegistration.deleteOne({ email });

    if (createdNewUser) {
      await createNotification({
        userId: user.id,
        title: 'Account Created',
        message: 'Welcome to Smart Waste Management System.',
      });
    }
  } else {
    let changed = false;
    if (!user.firebaseUid) {
      user.firebaseUid = identity.uid;
      user.firebaseProvider = identity.provider;
      changed = true;
    }
    if (user.email !== email) {
      if (await User.exists({ email, id: { $ne: user.id } })) {
        return res.status(409).json({ message: 'Email already belongs to another account.' });
      }
      user.email = email;
      changed = true;
    }
    if (changed) await user.save();
  }

  return sendLoginResponse(user, res);
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  if (req.user.role === 'admin') {
    await createAdminActivity({
      adminUser: req.user,
      sessionLabel: req.sessionLabel,
      action: 'Admin Logout',
      targetType: 'session',
      targetId: req.user.id,
      summary: 'Signed out from the Smart Waste admin portal.',
    });
    await AdminSession.deleteOne({ _id: req.adminSessionId });
    clearAdminCookie(res);
  } else {
    const update = { $inc: { tokenVersion: 1 } };
    if (req.user.role === 'worker') {
      update.$set = { workerOnline: false, workerLastSeenAt: null };
    }
    const previous = await User.findOneAndUpdate({ id: req.user.id }, update, { new: false });
    if (previous) {
      await createAccountActivity({
        actor: previous,
        action: previous.role === 'worker' ? 'Worker Logout' : 'User Logout',
        targetType: 'session',
        targetId: previous.id,
        summary: 'Signed out of Smart Waste.',
        details: accountActivitySnapshot(previous),
      });
      if (previous.role === 'worker' && previous.workerOnline) {
        await createAccountActivity({
          actor: previous, action: 'Worker Offline', targetType: 'worker', targetId: previous.id,
          summary: 'Went offline on logout.',
          details: { ...accountActivitySnapshot(previous), workerOnline: false, workerLastSeenAt: null },
        });
      }
    }
    if (req.user.role === 'worker') {
      await WorkerLocation.deleteOne({ workerId: req.user.id });
      fastCache.invalidate('workers:');
    }
  }

  return res.json({ message: 'Logged out successfully.' });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

app.put('/api/me', authMiddleware, async (req, res) => {
  const { firstName, lastName, gender, mobile, address, profileImage } = req.body ?? {};
  const user = await User.findOne({ id: req.user.id });
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const next = {
    firstName: cleanBoundedText(firstName ?? user.firstName, 100),
    lastName: cleanBoundedText(lastName ?? user.lastName, 100),
    gender: cleanBoundedText(gender ?? user.gender, 30),
    mobile: cleanBoundedText(mobile ?? user.mobile, 20),
    address: cleanBoundedText(address ?? user.address, 500),
  };
  if (Object.values(next).some((value) => !value)) {
    return res.status(400).json({ message: 'Profile fields are invalid or too long.' });
  }
  if (!/^\d{10,15}$/.test(next.mobile)) {
    return res.status(400).json({ message: 'Mobile must contain 10 to 15 digits.' });
  }
  const nextProfileImage = profileImage ?? user.profileImage ?? null;
  if (!isValidProfileImage(nextProfileImage)) {
    return res.status(400).json({ message: 'Profile image must be a JPEG, PNG, or WebP under 2 MB.' });
  }

  const oldProfileImage = user.profileImage ?? null;
  const storedProfileImage = await uploadMedia(nextProfileImage, 'profiles');
  Object.assign(user, next, { profileImage: storedProfileImage, updatedAt: new Date() });
  try {
    await user.save();
  } catch (error) {
    if (storedProfileImage !== oldProfileImage) {
      await deleteMedia(storedProfileImage).catch(() => undefined);
    }
    throw error;
  }
  if (oldProfileImage && oldProfileImage !== storedProfileImage) {
    await deleteMedia(oldProfileImage);
  }
  if (req.user.role === 'admin') {
    await createAdminActivity({
      adminUser: user,
      sessionLabel: req.sessionLabel,
      action: 'Profile Updated',
      targetType: 'admin',
      targetId: req.user.id,
      summary: 'Updated admin profile details.',
      details: accountActivitySnapshot(user),
    });
  }

  return res.json(sanitizeUser(user));
});

app.put(
  '/api/workers/me/availability',
  authMiddleware,
  requireRoles('worker'),
  async (req, res) => {
    const online = req.body?.online;
    if (typeof online !== 'boolean') {
      return res.status(400).json({ message: 'online must be true or false.' });
    }

    const now = new Date();
    const previous = await User.findOneAndUpdate(
      { id: req.user.id, role: 'worker' },
      {
        $set: {
          workerOnline: online,
          workerLastSeenAt: online ? now : null,
          updatedAt: now,
        },
      },
      { new: false },
    );
    if (!previous) return res.status(404).json({ message: 'Worker not found.' });
    const user = { ...cleanRecord(previous), workerOnline: online, workerLastSeenAt: online ? now : null, updatedAt: now };
    if (Boolean(previous.workerOnline) !== online) {
      await createAccountActivity({
        actor: user, action: online ? 'Worker Online' : 'Worker Offline', targetType: 'worker', targetId: user.id,
        summary: online ? 'Went online and became available for dispatch.' : 'Went offline.',
        details: accountActivitySnapshot(user),
      });
    }
    fastCache.invalidate('workers:');
    if (online) {
      await autoAssignUnassignedTickets(25);
    } else {
      await WorkerLocation.deleteOne({ workerId: req.user.id });
    }
    return res.json(sanitizeUser(user));
  },
);

app.post('/api/workers/me/heartbeat', authMiddleware, requireRoles('worker'), async (req, res) => {
  const result = await User.updateOne(
    { id: req.user.id, role: 'worker', workerOnline: true },
    { $set: { workerLastSeenAt: new Date() } },
  );
  return res.json({ online: result.matchedCount === 1 });
});

app.put('/api/workers/me/location', authMiddleware, requireRoles('worker'), async (req, res) => {
  const location = normalizeWorkerLocation(req.body ?? {});
  if (!location) {
    return res.status(400).json({ message: 'Valid latitude, longitude, and accuracy are required.' });
  }
  const worker = await User.findOne(
    { id: req.user.id, role: 'worker', workerOnline: true },
    { id: 1 },
  ).lean();
  if (!worker) {
    await WorkerLocation.deleteOne({ workerId: req.user.id });
    return res.status(409).json({ message: 'Go online before sharing live location.' });
  }
  const now = new Date();
  const sampledAt = req.body?.sampledAt === undefined ? now : new Date(req.body.sampledAt);
  if (!Number.isFinite(sampledAt.getTime()) || sampledAt.getTime() > now.getTime() + 5000 || now.getTime() - sampledAt.getTime() >= WORKER_LOCATION_TTL_MS) {
    return res.status(400).json({ message: 'Location must have a recent valid GPS timestamp.' });
  }
  const record = await WorkerLocation.findOneAndUpdate(
    { workerId: req.user.id },
    {
      $set: {
        ...location,
        updatedAt: sampledAt,
        expiresAt: new Date(sampledAt.getTime() + WORKER_LOCATION_TTL_MS),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await User.updateOne(
    { id: req.user.id, role: 'worker', workerOnline: true },
    { $set: { workerLastSeenAt: now } },
  );
  return res.json({
    available: true,
    latitude: record.latitude,
    longitude: record.longitude,
    accuracy: record.accuracy,
    updatedAt: record.updatedAt,
  });
});

app.get('/api/tickets/:id/worker-location', authMiddleware, async (req, res) => {
  const id = parseNumericId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ticket id.' });
  const ticket = await Ticket.findOne({ id }).lean();
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ message: 'No permission to view worker location.' });
  }
  if (!ticket.workerId || !['accepted', 'in_progress'].includes(ticket.status)) {
    return res.json({ available: false });
  }
  const location = await WorkerLocation.findOne({ workerId: ticket.workerId }).lean();
  if (!location || !isFreshWorkerLocation(location.updatedAt)) {
    return res.json({ available: false });
  }
  return res.json({
    available: true,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    updatedAt: location.updatedAt,
  });
});

app.get('/api/dashboard/summary', authMiddleware, requireRoles('admin'), async (_req, res) => {
  const [totalUsers, totalWorkers, onlineWorkers, totalTickets, pendingTickets] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'worker' }),
    User.countDocuments({
      role: 'worker',
      workerOnline: true,
      workerLastSeenAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) },
    }),
    Ticket.countDocuments(),
    Ticket.countDocuments({ status: 'pending' }),
  ]);

  res.json({
    totalUsers,
    totalWorkers,
    onlineWorkers,
    totalTickets,
    pendingTickets,
  });
});

app.get('/api/users', authMiddleware, requireRoles('admin'), async (req, res) => {
  const role = req.query?.role;
  if (role && !['user', 'worker'].includes(role)) {
    return res.status(400).json({ message: 'Account role must be user or worker.' });
  }
  const [users, ratings] = await Promise.all([
    User.find(role ? { role } : {}, { passwordHash: 0, profileImage: 0 }).sort({ createdAt: -1 }).limit(500),
    Review.aggregate([
      { $group: { _id: '$workerId', ratingAverage: { $avg: '$rating' }, ratingCount: { $sum: 1 } } },
    ]),
  ]);
  const ratingMap = new Map(ratings.map((item) => [Number(item._id), item]));
  res.json(
    users.map((user) => {
      const safe = sanitizeUser(user);
      return {
        ...safe,
        workerOnline:
          safe.role === 'worker' &&
          Boolean(safe.workerOnline) &&
          new Date(safe.workerLastSeenAt ?? 0).getTime() > Date.now() - 2 * 60 * 1000,
        ratingAverage: ratingMap.get(Number(user.id))?.ratingAverage ?? 0,
        ratingCount: ratingMap.get(Number(user.id))?.ratingCount ?? 0,
      };
    }),
  );
});

app.get('/api/activity', authMiddleware, requireRoles('admin'), async (req, res) => {
  let query;
  try {
    query = activityQuery(req.query);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  const { filter, page, limit } = query;
  const [items, total] = await Promise.all([
    AccountActivity.find(filter).sort({ createdAt: -1, id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AccountActivity.countDocuments(filter),
  ]);
  return res.json({ items: items.map(cleanRecord), total, page, limit });
});

app.get('/api/admin/worker-locations', authMiddleware, requireRoles('admin'), async (_req, res) => {
  const now = new Date();
  const [workers, locations, tickets] = await Promise.all([
    User.find({ role: 'worker', disabled: { $ne: true } }, {
      id: 1, firstName: 1, lastName: 1, email: 1, workerOnline: 1, workerLastSeenAt: 1,
    }).sort({ firstName: 1, id: 1 }).lean(),
    WorkerLocation.find({ expiresAt: { $gt: now } }).lean(),
    Ticket.find({ workerId: { $ne: null }, status: { $in: ['assigned', 'accepted', 'in_progress'] } }, {
      id: 1, ticketCode: 1, workerId: 1, status: 1, locationAddress: 1,
    }).lean(),
  ]);
  const locationMap = new Map(locations.map((location) => [Number(location.workerId), location]));
  const ticketsByWorker = new Map();
  for (const ticket of tickets) {
    const workerTickets = ticketsByWorker.get(ticket.workerId) ?? [];
    workerTickets.push({ id: ticket.id, ticketCode: ticket.ticketCode, status: ticket.status, locationAddress: ticket.locationAddress });
    ticketsByWorker.set(ticket.workerId, workerTickets);
  }
  return res.json({
    workers: workers.map((worker) => {
      const workerOnline = Boolean(worker.workerOnline) && isFreshWorkerLocation(worker.workerLastSeenAt, now.getTime());
      const location = locationMap.get(worker.id);
      const freshLocation = workerOnline && location && isFreshWorkerLocation(location.updatedAt, now.getTime());
      return {
        workerId: worker.id, firstName: worker.firstName, lastName: worker.lastName, email: worker.email,
        workerOnline, lastSeenAt: worker.workerLastSeenAt ?? null,
        location: freshLocation ? {
          latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy, updatedAt: location.updatedAt,
        } : null,
        activeTickets: ticketsByWorker.get(worker.id) ?? [],
      };
    }),
    updatedAt: now,
  });
});

const REPORT_ACCOUNT_LIMIT = 500;

app.get('/api/admin/reports/:role', authMiddleware, requireRoles('admin'), async (req, res) => {
  const role = req.params.role === 'users' ? 'user' : req.params.role === 'workers' ? 'worker' : null;
  if (!role) return res.status(400).json({ message: 'Report role must be users or workers.' });
  let period;
  try {
    period = activityDateRange(req.query);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  const filter = { role };
  if (period.from || period.to) {
    filter.createdAt = { ...(period.from ? { $gte: period.from } : {}), ...(period.to ? { $lte: period.to } : {}) };
  }
  const users = await User.find(filter, { passwordHash: 0, profileImage: 0 })
    .sort({ createdAt: -1 })
    .limit(REPORT_ACCOUNT_LIMIT + 1)
    .lean();
  if (users.length > REPORT_ACCOUNT_LIMIT) {
    return res.status(413).json({
      message: `Reports cover at most ${REPORT_ACCOUNT_LIMIT} accounts. Narrow the registration date range and try again.`,
    });
  }
  const assignmentField = role === 'worker' ? 'workerId' : 'userId';
  const counts = users.length ? await Ticket.aggregate([
    { $match: { [assignmentField]: { $in: users.map((user) => user.id) } } },
    { $group: {
      _id: `$${assignmentField}`,
      totalTickets: { $sum: 1 },
      completedTickets: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
      pendingTickets: { $sum: { $cond: [{ $in: ['$status', ['pending', 'assigned', 'accepted', 'in_progress']] }, 1, 0] } },
    } },
  ]) : [];
  const countMap = new Map(counts.map((count) => [Number(count._id), count]));
  const accounts = users.map((user) => {
    const count = countMap.get(user.id);
    return { ...sanitizeUser(user), totalTickets: count?.totalTickets ?? 0,
      completedTickets: count?.completedTickets ?? 0, pendingTickets: count?.pendingTickets ?? 0 };
  });
  const { buildAccountReport } = await import('./reports.js');
  const generatedAt = new Date();
  const pdf = await buildAccountReport({ role, accounts, generatedBy: sanitizeUser(req.user), generatedAt, period });
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="smartwaste-${req.params.role}-${generatedAt.toISOString().slice(0, 10)}.pdf"`);
  res.set('Cache-Control', 'no-store');
  return res.send(pdf);
});

app.post('/api/users', authMiddleware, requireRoles('admin'), async (req, res) => {
  const {
    firstName,
    lastName,
    gender,
    mobile,
    email,
    password,
    confirmPassword,
    role,
    address,
    profileImage = null,
    workerSkills = [],
  } = req.body ?? {};

  if (!firstName || !lastName || !mobile || !email || !password || !role || !address) {
    return res.status(400).json({ message: 'Missing required user fields.' });
  }

  const allowedRole = USER_ROLES.includes(role) ? role : null;
  if (!allowedRole) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }

  if (typeof password !== 'string' || !isStrongPassword(password)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }
  if (typeof confirmPassword !== 'string' || password !== confirmPassword) {
    return res.status(400).json({ message: 'Password and confirmation must match.' });
  }
  const suppliedId = req.body?.id;
  const explicitId = suppliedId === undefined || suppliedId === null || suppliedId === '' ? null : parseNumericId(suppliedId);
  if (suppliedId !== undefined && suppliedId !== null && suppliedId !== '' && (
    !['string', 'number'].includes(typeof suppliedId) || !explicitId || allowedRole !== 'worker'
  )) {
    return res.status(400).json({ message: 'An explicit positive numeric ID can only be supplied for a new worker.' });
  }
  if (explicitId && await User.exists({ id: explicitId })) {
    return res.status(409).json({ message: 'Account ID already exists.' });
  }
  const profile = normalizeAccountProfile({
    firstName,
    lastName,
    gender: gender ?? 'Other',
    mobile,
    address,
  });
  if (!profile) {
    return res.status(400).json({ message: 'Profile fields are invalid or too long.' });
  }
  if (!isValidProfileImage(profileImage)) {
    return res.status(400).json({ message: 'Profile image must be a JPEG, PNG, or WebP under 2 MB.' });
  }
  const normalizedSkills = Array.isArray(workerSkills)
    ? workerSkills.map((skill) => String(skill).trim()).filter(Boolean).slice(0, 20)
    : [];

  const existing = await User.findOne({ email: normalizedEmail }, { id: 1 }).lean();
  if (existing) {
    return res.status(409).json({ message: 'Email already exists.' });
  }

  const storedProfileImage = profileImage ? await uploadMedia(profileImage, 'profiles') : null;
  if (explicitId) {
    await Counter.findOneAndUpdate({ key: 'users' }, { $max: { value: explicitId } }, { upsert: true, setDefaultsOnInsert: true });
  }
  const now = new Date();
  let user;
  try {
    user = await User.create({
      id: explicitId ?? await nextId('users'),
      ...profile,
      email: normalizedEmail,
      passwordHash: await hashPassword(String(password)),
      role: allowedRole,
      profileImage: storedProfileImage,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
      workerOnline: false,
      workerSkills: allowedRole === 'worker' ? normalizedSkills : [],
    });
  } catch (error) {
    await deleteMedia(storedProfileImage).catch(() => undefined);
    if (error?.code === 11000) return res.status(409).json({ message: 'Email or account ID already exists.' });
    throw error;
  }
  await DeletedIdentity.deleteOne({ emailHash: hashAdminSecret(normalizedEmail) });

  await createAdminActivity({
    adminUser: req.user,
    sessionLabel: req.sessionLabel,
    action: 'Account Created',
    targetType: allowedRole,
    targetId: user.id,
    summary: `Created ${allowedRole} account for ${user.firstName} ${user.lastName}.`,
    details: accountActivitySnapshot(user),
  });

  res.status(201).json(sanitizeUser(user));
});

app.put('/api/users/:id', authMiddleware, requireRoles('admin'), async (req, res) => {
  const id = parseNumericId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }

  const existing = await User.findOne({ id });
  if (!existing) {
    return res.status(404).json({ message: 'User not found.' });
  }
  if (req.body?.id !== undefined && parseNumericId(req.body.id) !== id) {
    return res.status(400).json({ message: 'Account IDs cannot be changed.' });
  }
  const nextPassword = req.body?.password;
  const changingPassword = nextPassword !== undefined;
  if (changingPassword && (typeof nextPassword !== 'string' || !isStrongPassword(nextPassword))) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }
  if (changingPassword && (typeof req.body?.confirmPassword !== 'string' || nextPassword !== req.body.confirmPassword)) {
    return res.status(400).json({ message: 'Password and confirmation must match.' });
  }

  const role = req.body?.role ?? existing.role;
  if (!USER_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  const nextEmail = normalizeEmail(req.body?.email ?? existing.email);
  if (!/^\S+@\S+\.\S+$/.test(nextEmail)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }
  const duplicate = await User.findOne({ email: nextEmail, id: { $ne: id } }, { id: 1 }).lean();
  if (duplicate) {
    return res.status(409).json({ message: 'Email already exists.' });
  }

  const previousRole = existing.role;
  if (previousRole === 'worker' && role !== 'worker') {
    const [activeTicket, activeHire] = await Promise.all([
      Ticket.exists({ workerId: id, status: { $nin: ['completed', 'cancelled'] } }),
      HireRequest.exists({ assignedWorkerId: id, status: 'assigned' }),
    ]);
    if (activeTicket || activeHire) {
      return res.status(409).json({ message: 'Reassign active worker jobs before changing role.' });
    }
  }
  const profile = normalizeAccountProfile({
    firstName: req.body?.firstName ?? existing.firstName,
    lastName: req.body?.lastName ?? existing.lastName,
    gender: req.body?.gender ?? existing.gender,
    mobile: req.body?.mobile ?? existing.mobile,
    address: req.body?.address ?? existing.address,
  });
  if (!profile) {
    return res.status(400).json({ message: 'Profile fields are invalid or too long.' });
  }
  const oldEmail = existing.email;
  const oldProfileImage = existing.profileImage ?? null;
  const nextProfileImage = req.body?.profileImage ?? oldProfileImage;
  if (!isValidProfileImage(nextProfileImage)) {
    return res.status(400).json({ message: 'Profile image must be a JPEG, PNG, or WebP under 2 MB.' });
  }
  const storedProfileImage = nextProfileImage
    ? await uploadMedia(nextProfileImage, 'profiles')
    : null;

  const oldAccount = typeof existing.toObject === 'function' ? existing.toObject() : { ...existing };
  let firebaseRecord = null;
  const firebaseChanges = {};
  if (nextEmail !== oldEmail || (changingPassword && previousRole === 'user')) {
    if (existing.firebaseUid && !isFirebaseEnabled()) {
      if (storedProfileImage !== oldProfileImage) await deleteMedia(storedProfileImage);
      return res.status(503).json({ message: 'Firebase identity service is unavailable.' });
    }
    firebaseRecord = await firebaseRecordForUser(existing);
    if (firebaseRecord) {
      const providers = firebaseRecord.providerData ?? [];
      if (nextEmail !== oldEmail && providers.some((provider) => provider.providerId === 'google.com')) {
        if (storedProfileImage !== oldProfileImage) await deleteMedia(storedProfileImage);
        return res.status(409).json({
          message: 'Google account emails are managed by Google and cannot be changed here.',
        });
      }
      if (changingPassword && !providers.some((provider) => provider.providerId === 'password')) {
        if (storedProfileImage !== oldProfileImage) await deleteMedia(storedProfileImage);
        return res.status(409).json({ message: 'This account uses provider sign-in; its password is managed by that provider.' });
      }
      if (nextEmail !== oldEmail) firebaseChanges.email = nextEmail;
      if (changingPassword) firebaseChanges.password = nextPassword;
    }
  }

  const set = { ...profile, email: nextEmail, role, profileImage: storedProfileImage,
    updatedAt: nextAccountTimestamp(existing.updatedAt) };
  if (changingPassword) set.passwordHash = await hashPassword(nextPassword);
  const credentialsChanged = changingPassword || nextEmail !== oldEmail || role !== previousRole;
  if (firebaseRecord) {
    set.firebaseUid = firebaseRecord.uid;
    set.firebaseProvider = firebaseProviderFromRecord(firebaseRecord);
  }
  if (role === 'worker' && Array.isArray(req.body?.workerSkills)) {
    set.workerSkills = req.body.workerSkills
      .map((skill) => String(skill).trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (role !== 'worker') {
    set.workerOnline = false;
    set.workerSkills = [];
  }
  let updatedAccount;
  try {
    updatedAccount = await User.findOneAndUpdate(accountWriteGuard(existing), {
      $set: set, ...(credentialsChanged ? { $inc: { tokenVersion: 1 } } : {}),
    }, { new: true, runValidators: true });
  } catch (error) {
    if (storedProfileImage !== oldProfileImage) {
      await deleteMedia(storedProfileImage).catch(() => undefined);
    }
    if (error?.code === 11000) return res.status(409).json({ message: 'Email already exists.' });
    throw error;
  }
  if (!updatedAccount) {
    if (storedProfileImage !== oldProfileImage) await deleteMedia(storedProfileImage).catch(() => undefined);
    return res.status(409).json({ message: 'Account changed before this update. Refresh and retry.' });
  }
  try {
    if (credentialsChanged) await AdminSession.deleteMany({ userId: updatedAccount.id });
    if (firebaseRecord && Object.keys(firebaseChanges).length) {
      await updateFirebaseUser(firebaseRecord.uid, firebaseChanges);
    }
  } catch (error) {
    // Restore only this request's fields when its write is still current. Another
    // edit must keep both its account data and its newer revocation version.
    const restore = { updatedAt: nextAccountTimestamp(updatedAccount.updatedAt) };
    const unset = {};
    for (const key of Object.keys(set)) {
      if (key === 'updatedAt') continue;
      if (oldAccount[key] === undefined) unset[key] = 1;
      else restore[key] = oldAccount[key];
    }
    const rolledBack = await User.findOneAndUpdate({ id, updatedAt: updatedAccount.updatedAt,
      tokenVersion: Number(updatedAccount.tokenVersion ?? 0) }, {
      $set: restore,
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
      ...(credentialsChanged ? { $inc: { tokenVersion: 1 } } : {}),
    }, { new: true, runValidators: true });
    if (!rolledBack) return res.status(409).json({ message: 'Account changed during identity update. Refresh and retry.' });
    if (storedProfileImage !== oldProfileImage) await deleteMedia(storedProfileImage).catch(() => undefined);
    fastCache.invalidate('workers:');
    if (error?.code === 'auth/email-already-exists') return res.status(409).json({ message: 'Email already exists in Firebase.' });
    throw error;
  }
  if (oldProfileImage && oldProfileImage !== storedProfileImage) {
    await deleteMedia(oldProfileImage);
  }
  fastCache.invalidate('workers:');

  await createAdminActivity({
    adminUser: req.user,
    sessionLabel: req.sessionLabel,
    action: 'Account Updated',
    targetType: updatedAccount.role,
    targetId: updatedAccount.id,
    summary: `Updated ${updatedAccount.firstName} ${updatedAccount.lastName} account. Role ${previousRole} to ${updatedAccount.role}.`,
    details: accountActivitySnapshot(updatedAccount),
  });

  res.json(sanitizeUser(updatedAccount));
});

app.delete('/api/users/:id', authMiddleware, requireRoles('admin'), async (req, res) => {
  const id = parseNumericId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }

  if (id === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete your own account.' });
  }

  const user = await User.findOne({ id });
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const ownedTickets = await Ticket.find(
    { userId: id },
    { id: 1, mediaData: 1, completionMediaData: 1 },
  ).lean();
  const ownedTicketIds = ownedTickets.map((ticket) => Number(ticket.id));
  const now = new Date();
  user.disabled = true;
  user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
  await user.save();

  const firebaseRecord = await firebaseRecordForUser(user);
  await DeletedIdentity.findOneAndUpdate(
    { emailHash: hashAdminSecret(user.email) },
    {
      $set: {
        firebaseUidHash:
          firebaseRecord?.uid || user.firebaseUid
            ? hashAdminSecret(firebaseRecord?.uid ?? user.firebaseUid)
            : undefined,
        deletedAt: now,
        deletedByAdminId: req.user.id,
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  if (firebaseRecord) await deleteFirebaseUser(firebaseRecord.uid);

  const mediaUrls = [
    user.profileImage,
    ...ownedTickets.flatMap((ticket) => [ticket.mediaData, ticket.completionMediaData]),
  ].filter(Boolean);
  for (const mediaUrl of new Set(mediaUrls)) await deleteMedia(mediaUrl);

  await Ticket.deleteMany({ userId: id });
  await Ticket.updateMany(
    { workerId: id, status: { $nin: ['completed', 'cancelled'] } },
    {
      $set: { workerId: null, status: 'pending', updatedAt: now },
      $push: {
        statusHistory: {
          status: 'pending',
          actorId: req.user.id,
          actorRole: 'admin',
          note: 'Worker account removed; returned to dispatch queue.',
          createdAt: now,
        },
      },
    },
  );
  await HireRequest.deleteMany({ userId: id });
  await HireRequest.updateMany(
    { assignedWorkerId: id, status: 'assigned' },
    {
      $set: {
        assignedWorkerId: null,
        status: 'pending',
        assignedByAdminId: null,
        assignedAt: null,
        completedAt: null,
        updatedAt: now,
      },
    },
  );
  await Notification.deleteMany({ userId: id });
  await Notification.updateMany({ readBy: id }, { $pull: { readBy: id } });
  await AdminSession.deleteMany({ userId: id });
  await PendingRegistration.deleteMany({ email: user.email });
  await TicketMessage.deleteMany({
    $or: [{ senderId: id }, ...(ownedTicketIds.length ? [{ ticketId: { $in: ownedTicketIds } }] : [])],
  });
  await Review.deleteMany({
    $or: [
      { userId: id },
      { workerId: id },
      ...(ownedTicketIds.length ? [{ ticketId: { $in: ownedTicketIds } }] : []),
    ],
  });
  await WorkerLocation.deleteOne({ workerId: id });
  fastCache.invalidate('workers:');
  fastCache.invalidate(`reviews:${id}`);

  await createAdminActivity({
    adminUser: req.user,
    sessionLabel: req.sessionLabel,
    action: 'Account Deleted',
    targetType: user.role,
    targetId: user.id,
    summary: `Deleted ${user.role} account for ${user.firstName} ${user.lastName}.`,
    details: accountActivitySnapshot(user),
  });

  await User.deleteOne({ id, disabled: true });

  return res.json({ message: 'User deleted.' });
});

app.get('/api/tickets', authMiddleware, async (req, res) => {
  const role = req.user.role;
  let rows = [];

  const includeMedia = req.query?.includeMedia === 'true';
  const projection = includeMedia ? {} : { mediaData: 0, completionMediaData: 0 };

  if (role === 'user') {
    rows = await Ticket.find({ userId: req.user.id }, projection).sort({ updatedAt: -1 }).limit(200);
  } else if (role === 'worker') {
    const busy = await HireRequest.findOne(
      { assignedWorkerId: req.user.id, status: 'assigned' },
      { id: 1 },
    ).lean();

    if (busy) {
      rows = await Ticket.find({ workerId: req.user.id, status: 'completed' }, projection)
        .sort({ updatedAt: -1 })
        .limit(200);
      return res.json(await buildTicketRecords(rows, req.user));
    }

    // Attempt to distribute any unassigned tickets when a free worker opens the tickets view.
    await autoAssignUnassignedTickets(10);

    rows = await Ticket.find({ workerId: req.user.id }, projection).sort({ updatedAt: -1 }).limit(200);
  } else {
    rows = await Ticket.find({}, projection).sort({ updatedAt: -1 }).limit(200);
  }

  res.json(await buildTicketRecords(rows, req.user));
});

app.get('/api/tickets/:id', authMiddleware, async (req, res) => {
  const id = parseNumericId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ticket id.' });

  const ticket = await Ticket.findOne({ id });
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ message: 'No permission to view this ticket.' });
  }

  const [record] = await buildTicketRecords([ticket], req.user);
  return res.json(record);
});

app.get('/api/hire-requests', authMiddleware, async (req, res) => {
  const role = req.user.role;
  let rows = [];

  if (role === 'admin') {
    rows = await HireRequest.find().sort({ updatedAt: -1 }).limit(200);
  } else if (role === 'user') {
    rows = await HireRequest.find({ userId: req.user.id }).sort({ updatedAt: -1 }).limit(200);
  } else {
    rows = await HireRequest.find({ assignedWorkerId: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(200);
  }

  const workerIds = [
    ...new Set(
      rows
        .map((request) => request.assignedWorkerId)
        .filter((value) => Number.isFinite(Number(value)) && Number(value) > 0),
    ),
  ];

  const workers = workerIds.length
    ? await User.find({ id: { $in: workerIds }, role: 'worker' }).lean()
    : [];
  const workerMap = new Map(workers.map((worker) => [worker.id, worker]));

  res.json(
    rows.map((request) => {
      const record = cleanRecord(request);
      return {
        ...record,
        assignedWorker:
          record.assignedWorkerId && workerMap.has(record.assignedWorkerId)
            ? role === 'admin' || role === 'worker'
              ? sanitizeUser(workerMap.get(record.assignedWorkerId))
              : publicWorkerProfile(workerMap.get(record.assignedWorkerId))
            : null,
      };
    }),
  );
});

app.post('/api/hire-requests', authMiddleware, requireRoles('user'), async (req, res) => {
  const { title, purpose, workAddress } = req.body ?? {};
  const cleanTitle = cleanBoundedText(title, 150);
  const cleanPurpose = cleanBoundedText(purpose, 1_000);
  const cleanWorkAddress = cleanBoundedText(workAddress || req.user.address, 500);
  if (!cleanTitle || !cleanPurpose || !cleanWorkAddress) {
    return res.status(400).json({ message: 'Hire request fields are invalid or too long.' });
  }

  const now = new Date();
  const id = await nextId('hireRequests');
  const requestCode = `HIRE-${String(id).padStart(4, '0')}`;

  const requesterName =
    `${req.user.firstName ?? ''} ${req.user.lastName ?? ''}`.trim() || `User #${req.user.id}`;

  const request = await HireRequest.create({
    id,
    requestCode,
    userId: req.user.id,
    requesterName,
    requesterMobile: String(req.user.mobile ?? '').trim(),
    requesterEmail: normalizeEmail(req.user.email),
    requesterAddress: String(req.user.address ?? '').trim(),
    title: cleanTitle,
    purpose: cleanPurpose,
    workAddress: cleanWorkAddress,
    status: 'pending',
    assignedWorkerId: null,
    assignedByAdminId: null,
    assignedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const admins = await User.find({ role: 'admin' }, { id: 1 }).lean();
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title: 'New Worker Hire Request',
        message: `${requestCode} "${cleanTitle}" from ${requesterName} (${req.user.mobile}). Purpose: ${cleanPurpose}.`,
      }),
    ),
  );

  res.status(201).json(cleanRecord(request));
});

app.put(
  '/api/hire-requests/:id/assign',
  authMiddleware,
  requireRoles('admin'),
  async (req, res) => {
    const id = parseNumericId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid request id.' });
    }

    let request = await HireRequest.findOne({ id });
    if (!request) {
      return res.status(404).json({ message: 'Hire request not found.' });
    }

    const workerId = parseNumericId(req.body?.workerId);
    if (!workerId) {
      return res.status(400).json({ message: 'Valid worker id is required.' });
    }

    const worker = await User.findOne({ id: workerId, role: 'worker' }).lean();
    if (!worker) {
      return res.status(400).json({ message: 'Worker not found.' });
    }

    const workerBusy = await HireRequest.findOne(
      { assignedWorkerId: workerId, status: 'assigned', id: { $ne: request.id } },
      { id: 1 },
    ).lean();
    if (workerBusy) {
      return res.status(400).json({ message: 'Worker is already assigned.' });
    }

    const now = new Date();
    try {
      request = await HireRequest.findOneAndUpdate(
        { id, status: { $in: ['pending', 'assigned'] } },
        {
          $set: {
            title: request.title || 'Personal Work',
            assignedWorkerId: workerId,
            assignedByAdminId: req.user.id,
            assignedAt: now,
            completedAt: null,
            status: 'assigned',
            updatedAt: now,
          },
        },
        { new: true },
      );
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ message: 'Worker is already assigned.' });
      }
      throw error;
    }
    if (!request) {
      return res.status(409).json({ message: 'Only pending or assigned requests can be assigned.' });
    }

    // When a worker is hired for personal work, they should not receive tickets.
    // Re-distribute any open tickets that were assigned to this worker.
    await Ticket.updateMany(
      { workerId, status: { $nin: ['completed', 'cancelled'] } },
      {
        $set: { workerId: null, status: 'pending', updatedAt: now },
        $push: {
          statusHistory: {
            status: 'pending',
            actorId: req.user.id,
            actorRole: 'admin',
            note: 'Worker moved to a personal hire assignment.',
            createdAt: now,
          },
        },
      },
    );
    await autoAssignUnassignedTickets(25);

    const workerName =
      `${worker.firstName ?? ''} ${worker.lastName ?? ''}`.trim() || `Worker #${worker.id}`;

    await Promise.all([
      createNotification({
        userId: request.userId,
        title: 'Your Worker Hired',
        message: `${request.requestCode} "${request.title}": ${workerName} (${worker.mobile}) assigned for "${request.purpose}".`,
      }),
      createNotification({
        userId: workerId,
        title: 'New Hire Assignment',
        message: `${request.requestCode} "${request.title}": Assigned by admin. User: ${request.requesterName} (${request.requesterMobile}). Address: ${request.workAddress}. Purpose: ${request.purpose}.`,
      }),
    ]);

    await createAdminActivity({
      adminUser: req.user,
      sessionLabel: req.sessionLabel,
      action: 'Hire Assigned',
      targetType: 'hire-request',
      targetId: request.id,
      summary: `Assigned ${workerName} to ${request.requestCode}.`,
    });

    res.json({
      ...cleanRecord(request),
      assignedWorker: sanitizeUser(worker),
    });
  },
);

app.put(
  '/api/hire-requests/:id/complete',
  authMiddleware,
  requireRoles('worker'),
  async (req, res) => {
    const id = parseNumericId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid request id.' });
    }

    let request = await HireRequest.findOne({ id });
    if (!request) {
      return res.status(404).json({ message: 'Hire request not found.' });
    }

    if (request.assignedWorkerId !== req.user.id) {
      return res.status(403).json({ message: 'No permission to complete this task.' });
    }

    if (request.status !== 'assigned') {
      return res.status(400).json({ message: 'Only assigned tasks can be completed.' });
    }

    const now = new Date();
    request = await HireRequest.findOneAndUpdate(
      { id, assignedWorkerId: req.user.id, status: 'assigned' },
      {
        $set: {
          title: request.title || 'Personal Work',
          status: 'completed',
          completedAt: now,
          updatedAt: now,
        },
      },
      { new: true },
    );
    if (!request) {
      return res.status(409).json({ message: 'Hire request changed before completion.' });
    }

    const workerName =
      `${req.user.firstName ?? ''} ${req.user.lastName ?? ''}`.trim() || `Worker #${req.user.id}`;

    const admins = await User.find({ role: 'admin' }, { id: 1 }).lean();
    await Promise.all([
      createNotification({
        userId: request.userId,
        title: 'Hired Task Completed',
        message: `${request.requestCode} "${request.title}" completed by ${workerName}.`,
      }),
      ...admins.map((admin) =>
        createNotification({
          userId: admin.id,
          title: 'Hired Task Completed',
          message: `${request.requestCode} "${request.title}" marked completed by Worker #${req.user.id}. User: ${request.requesterName} (${request.requesterMobile}).`,
        }),
      ),
    ]);

    // Worker is free now; auto-assign any waiting tickets.
    await autoAssignUnassignedTickets(25);

    res.json(cleanRecord(request));
  },
);

app.delete(
  '/api/hire-requests/:id',
  authMiddleware,
  async (req, res) => {
    const id = parseNumericId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid request id.' });
    }

    const request = await HireRequest.findOne({ id });
    if (!request) {
      return res.status(404).json({ message: 'Hire request not found.' });
    }

    if (req.user.role === 'user') {
      if (request.userId !== req.user.id) {
        return res.status(403).json({ message: 'No permission to delete this hire request.' });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ message: 'Only pending hire requests can be deleted.' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'No permission to delete hire requests.' });
    }

    await HireRequest.deleteOne({ id });
    if (request.status === 'assigned') {
      await autoAssignUnassignedTickets(25);
    }

    if (req.user.role === 'admin') {
      await createAdminActivity({
        adminUser: req.user,
        sessionLabel: req.sessionLabel,
        action: 'Hire Request Deleted',
        targetType: 'hire-request',
        targetId: request.id,
        summary: `Deleted hire request ${request.requestCode}.`,
      });
    } else {
      const admins = await User.find({ role: 'admin' }, { id: 1 }).lean();
      await Promise.all(
        admins.map((admin) =>
          createNotification({
            userId: admin.id,
            title: 'Hire Request Deleted',
            message: `${request.requestCode} deleted by ${request.requesterName} (${request.requesterMobile}).`,
          }),
        ),
      );
    }

    res.json({ message: 'Hire request deleted.' });
  },
);

app.post('/api/tickets', ticketCreateLimiter, authMiddleware, async (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'Only users can create tickets.' });
  }

  const {
    wasteType,
    description,
    locationAddress,
    priority = 'medium',
    mediaData = null,
  } = req.body ?? {};

  const cleanWasteType = cleanBoundedText(wasteType, 100);
  const cleanDescription = cleanBoundedText(description);
  const cleanLocation = cleanBoundedText(locationAddress, 500);
  if (!cleanWasteType || !cleanDescription || !cleanLocation) {
    return res.status(400).json({ message: 'Missing ticket fields.' });
  }
  if (!isValidImageData(mediaData)) {
    return res.status(400).json({ message: 'Ticket image must be a JPEG, PNG, or WebP under 2 MB.' });
  }

  const storedMedia = await uploadMedia(mediaData, 'tickets');
  const now = new Date();
  const id = await nextId('tickets');
  let ticket;
  try {
    ticket = await Ticket.create({
      id,
      ticketCode: `SWM-${String(id).padStart(6, '0')}`,
      userId: req.user.id,
      workerId: null,
      wasteType: cleanWasteType,
      description: cleanDescription,
      mediaData: storedMedia,
      locationAddress: cleanLocation,
      status: 'pending',
      priority: TICKET_PRIORITIES.includes(priority) ? priority : 'medium',
      statusHistory: [
        {
          status: 'pending',
          actorId: req.user.id,
          actorRole: req.user.role,
          note: 'Ticket created.',
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    await deleteMedia(storedMedia).catch(() => undefined);
    throw error;
  }

  fastCache.invalidate('workers:');

  const ticketDetailsMessage = buildTicketDetailsMessage(ticket, req.user);
  const assignedWorkerId = await pickFreeWorkerIdForTicket(cleanWasteType);
  if (assignedWorkerId) {
    ticket.workerId = assignedWorkerId;
    appendTicketStatus(
      ticket,
      'assigned',
      { id: null, role: 'system' },
      `Automatically assigned to Worker #${assignedWorkerId}.`,
    );
    await ticket.save();

    await createNotification({
      userId: assignedWorkerId,
      title: 'New Ticket Assigned',
      message: ticketDetailsMessage,
    });
  } else {
    const admins = await User.find({ role: 'admin' }, { id: 1 }).lean();
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          title: 'Ticket Awaiting Worker',
          message: `${ticketDetailsMessage} | Waiting: no free worker available.`,
        }),
      ),
    );
  }

  await createNotification({
    title: 'New Ticket Created',
    message: assignedWorkerId
      ? `${ticket.ticketCode} created. Assigned to Worker #${assignedWorkerId}.`
      : `${ticket.ticketCode} created. Waiting for worker assignment.`,
    userId: req.user.id,
  });

  await createAccountActivity({
    actor: req.user, action: 'Ticket Created', targetType: 'ticket', targetId: ticket.id,
    summary: `Created ${ticket.ticketCode} for ${ticket.wasteType} collection.`,
    details: await ticketActivityDetails(ticket),
  });

  const [record] = await buildTicketRecords([ticket], req.user);
  res.status(201).json(record);
});

app.put(
  '/api/tickets/:id/assign',
  authMiddleware,
  requireRoles('admin'),
  async (req, res) => {
    const id = parseNumericId(req.params.id);
    const workerId = parseNumericId(req.body?.workerId);
    if (!id || !workerId) {
      return res.status(400).json({ message: 'Valid ticket and worker ids are required.' });
    }

    const [ticket, worker] = await Promise.all([
      Ticket.findOne({ id }),
      User.findOne({ id: workerId, role: 'worker' }).lean(),
    ]);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
    if (!worker) return res.status(400).json({ message: 'Worker not found.' });
    if (!['pending', 'assigned'].includes(ticket.status)) {
      return res.status(409).json({ message: 'Only pending or assigned tickets can be dispatched.' });
    }
    const hired = await HireRequest.exists({ assignedWorkerId: workerId, status: 'assigned' });
    if (hired) {
      return res.status(409).json({ message: 'Worker is busy with a personal hire request.' });
    }

    const now = new Date();
    const updatedTicket = await Ticket.findOneAndUpdate(
      { id, status: ticket.status, updatedAt: ticket.updatedAt },
      {
        $set: { workerId, status: 'assigned', updatedAt: now },
        $push: {
          statusHistory: {
            status: 'assigned',
            actorId: req.user.id,
            actorRole: req.user.role,
            note: `Assigned to Worker #${workerId} by admin.`,
            createdAt: now,
          },
        },
      },
      { new: true },
    );
    if (!updatedTicket) {
      return res.status(409).json({ message: 'Ticket changed before assignment. Refresh and retry.' });
    }
    await Promise.all([
      createNotification({
        userId: workerId,
        title: 'New Ticket Assigned',
        message: buildTicketDetailsMessage(updatedTicket, await User.findOne({ id: updatedTicket.userId }).lean()),
      }),
      createNotification({
        userId: updatedTicket.userId,
        title: 'Worker Assigned',
        message: `${ticket.ticketCode} was assigned to ${worker.firstName} ${worker.lastName}.`,
      }),
      createAdminActivity({
        adminUser: req.user,
        sessionLabel: req.sessionLabel,
        action: 'Ticket Assigned',
        targetType: 'ticket',
        targetId: updatedTicket.id,
        summary: `Assigned ${updatedTicket.ticketCode} to Worker #${workerId}.`,
        details: await ticketActivityDetails(updatedTicket),
      }),
    ]);

    const [record] = await buildTicketRecords([updatedTicket], req.user);
    return res.json(record);
  },
);

app.put(
  '/api/tickets/:id/status',
  authMiddleware,
  requireRoles('worker'),
  async (req, res) => {
    const id = parseNumericId(req.params.id);
    const status = String(req.body?.status ?? '');
    if (!id) return res.status(400).json({ message: 'Invalid ticket id.' });

    const ticket = await Ticket.findOne({ id });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
    if (ticket.workerId !== req.user.id) {
      return res.status(403).json({ message: 'This ticket is not assigned to you.' });
    }
    const hired = await HireRequest.exists({ assignedWorkerId: req.user.id, status: 'assigned' });
    if (hired) {
      return res.status(403).json({ message: 'Worker is currently assigned to a hired task.' });
    }
    if (!canWorkerTransition(ticket.status, status)) {
      return res.status(409).json({
        message: `Cannot move ticket from ${ticket.status} to ${status || 'unknown'}.`,
      });
    }

    const now = new Date();
    let userNotification = null;
    const set = { status, updatedAt: now };
    let completionMediaUrl = null;
    let note = '';
    if (status === 'accepted') {
      set.acceptedAt = now;
      note = 'Worker accepted the ticket.';
      userNotification = {
        userId: ticket.userId,
        title: 'Worker Accepted Ticket',
        message: `${ticket.ticketCode} was accepted by the assigned worker.`,
      };
    } else if (status === 'in_progress') {
      const completionCode = createCompletionCode();
      set.startedAt = now;
      set.completionCode = completionCode;
      set.completionCodeHash = hashAdminSecret(completionCode);
      note = 'Worker started the collection.';
      userNotification = {
        userId: ticket.userId,
        title: 'Collection Started',
        message: `${ticket.ticketCode} started. Completion code: ${completionCode}. Share it only after the work is complete.`,
      };
    } else if (status === 'completed') {
      const completionCode = String(req.body?.completionCode ?? '').trim();
      const completionMediaData = req.body?.completionMediaData ?? null;
      if (!/^\d{6}$/.test(completionCode) || !ticket.completionCodeHash) {
        return res.status(400).json({ message: 'A valid 6-digit completion code is required.' });
      }
      if (!matchesAdminSecret(completionCode, ticket.completionCodeHash)) {
        return res.status(403).json({ message: 'Completion code is incorrect.' });
      }
      if (!isValidImageData(completionMediaData, { required: true })) {
        return res.status(400).json({
          message: 'An after-photo (JPEG, PNG, or WebP under 2 MB) is required.',
        });
      }
      completionMediaUrl = await uploadMedia(completionMediaData, 'completion');
      set.completedAt = now;
      set.completionMediaData = completionMediaUrl;
      set.completionCode = null;
      set.completionCodeHash = null;
      note = 'Work completed with OTP verification.';
      userNotification = {
        userId: ticket.userId,
        title: 'Ticket Completed',
        message: `${ticket.ticketCode} was completed. Please rate the worker.`,
      };
    }

    const updatedTicket = await Ticket.findOneAndUpdate(
      {
        id,
        workerId: req.user.id,
        status: ticket.status,
        updatedAt: ticket.updatedAt,
      },
      {
        $set: set,
        $push: {
          statusHistory: {
            status,
            actorId: req.user.id,
            actorRole: req.user.role,
            note,
            createdAt: now,
          },
        },
      },
      { new: true },
    );
    if (!updatedTicket) {
      if (completionMediaUrl) await deleteMedia(completionMediaUrl).catch(() => undefined);
      return res.status(409).json({ message: 'Ticket changed before this update. Refresh and retry.' });
    }
    await createAccountActivity({
      actor: req.user,
      action: status === 'accepted' ? 'Ticket Accepted' : status === 'in_progress' ? 'Ticket Started' : 'Ticket Completed',
      targetType: 'ticket', targetId: updatedTicket.id,
      summary: `${updatedTicket.ticketCode} ${status === 'in_progress' ? 'started' : status}.`,
      details: await ticketActivityDetails(updatedTicket),
    });
    fastCache.invalidate('workers:');
    if (userNotification) await createNotification(userNotification);
    if (status === 'completed') await autoAssignUnassignedTickets(25);
    const [record] = await buildTicketRecords([updatedTicket], req.user);
    return res.json(record);
  },
);

app.put('/api/tickets/:id/cancel', authMiddleware, async (req, res) => {
  const id = parseNumericId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ticket id.' });
  const ticket = await Ticket.findOne({ id });
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && ticket.userId !== req.user.id) {
    return res.status(403).json({ message: 'No permission to cancel this ticket.' });
  }
  const canCancel = isAdmin
    ? !isClosedTicket(ticket.status)
    : ['pending', 'assigned'].includes(ticket.status);
  if (!canCancel) {
    return res.status(409).json({ message: 'This ticket cannot be cancelled.' });
  }

  const previousWorkerId = ticket.workerId;
  const now = new Date();
  const updatedTicket = await Ticket.findOneAndUpdate(
    { id, status: ticket.status, workerId: ticket.workerId, updatedAt: ticket.updatedAt },
    {
      $set: { workerId: null, status: 'cancelled', cancelledAt: now, completionCode: null, completionCodeHash: null, updatedAt: now },
      $push: { statusHistory: {
        status: 'cancelled', actorId: req.user.id, actorRole: req.user.role,
        note: String(req.body?.reason ?? 'Ticket cancelled.').trim().slice(0, 500), createdAt: now,
      } },
    },
    { new: true },
  );
  if (!updatedTicket) return res.status(409).json({ message: 'Ticket changed before cancellation. Refresh and retry.' });
  fastCache.invalidate('workers:');
  if (previousWorkerId) {
    await createNotification({
      userId: previousWorkerId,
      title: 'Ticket Cancelled',
      message: `${ticket.ticketCode} was cancelled.`,
    });
  }
  if (isAdmin) {
    await createAdminActivity({
      adminUser: req.user,
      sessionLabel: req.sessionLabel,
      action: 'Ticket Cancelled',
      targetType: 'ticket',
      targetId: ticket.id,
      summary: `Cancelled ticket ${ticket.ticketCode}.`,
      details: await ticketActivityDetails(updatedTicket),
    });
  } else {
    await createAccountActivity({
      actor: req.user, action: 'Ticket Cancelled', targetType: 'ticket', targetId: id,
      summary: `Cancelled ${ticket.ticketCode}.`, details: await ticketActivityDetails(updatedTicket),
    });
  }
  const [record] = await buildTicketRecords([updatedTicket], req.user);
  return res.json(record);
});

app.put('/api/tickets/:id', authMiddleware, async (req, res) => {
  const id = parseNumericId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  const ticket = await Ticket.findOne({ id });
  if (!ticket) {
    return res.status(404).json({ message: 'Ticket not found.' });
  }

  const isAdmin = req.user.role === 'admin';
  const isWorker = req.user.role === 'worker';
  const isOwner = ticket.userId === req.user.id;

  if (isAdmin) {
    return res.status(403).json({ message: 'Admin can only review or delete tickets.' });
  }

  if (!isWorker && !isOwner) {
    return res.status(403).json({ message: 'No permission to update ticket.' });
  }

  if (isWorker) {
    return res.status(409).json({ message: 'Use the tracked ticket status actions.' });
  }

  if (req.body?.status !== undefined) {
    return res.status(403).json({ message: 'Only workers can update ticket status.' });
  }

  if (req.body?.workerId !== undefined) {
    return res.status(403).json({ message: 'Ticket assignment is automatic.' });
  }

  if (!['pending', 'assigned'].includes(ticket.status)) {
    return res.status(409).json({ message: 'Accepted or closed tickets cannot be edited.' });
  }

  const nextWasteType = cleanBoundedText(req.body?.wasteType ?? ticket.wasteType, 100);
  const nextDescription = cleanBoundedText(req.body?.description ?? ticket.description);
  const nextLocation = cleanBoundedText(req.body?.locationAddress ?? ticket.locationAddress, 500);
  const nextMediaData = req.body?.mediaData ?? ticket.mediaData ?? null;
  if (!nextWasteType || !nextDescription || !nextLocation) {
    return res.status(400).json({ message: 'Ticket fields are invalid or too long.' });
  }
  if (!isValidImageData(nextMediaData)) {
    return res.status(400).json({ message: 'Ticket image must be a JPEG, PNG, or WebP under 2 MB.' });
  }

  const oldMediaData = ticket.mediaData ?? null;
  const storedMediaData = await uploadMedia(nextMediaData, 'tickets');
  ticket.wasteType = nextWasteType;
  ticket.description = nextDescription;
  ticket.mediaData = storedMediaData;
  ticket.locationAddress = nextLocation;
  ticket.priority = TICKET_PRIORITIES.includes(req.body?.priority)
    ? req.body.priority
    : ticket.priority;
  ticket.updatedAt = new Date();
  try {
    await ticket.save();
  } catch (error) {
    if (storedMediaData !== oldMediaData) {
      await deleteMedia(storedMediaData).catch(() => undefined);
    }
    throw error;
  }
  if (oldMediaData && oldMediaData !== storedMediaData) {
    await deleteMedia(oldMediaData);
  }

  if (ticket.workerId) {
    await createNotification({
      userId: ticket.workerId,
      title: 'Assigned Ticket Updated',
      message: `${ticket.ticketCode} details were updated by the requester.`,
    });
  }
  const [record] = await buildTicketRecords([ticket], req.user);
  return res.json(record);
});

app.delete('/api/tickets/:id', authMiddleware, async (req, res) => {
  const id = parseNumericId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  const ticket = await Ticket.findOne({ id });
  if (!ticket) {
    return res.status(404).json({ message: 'Ticket not found.' });
  }

  const isAdmin = req.user.role === 'admin';
  const isOwner = ticket.userId === req.user.id;
  if (!isAdmin && !isOwner) {
    return res.status(403).json({ message: 'No permission to delete ticket.' });
  }
  if (isOwner && !['pending', 'cancelled'].includes(ticket.status)) {
    return res.status(409).json({ message: 'Cancel active tickets instead of deleting them.' });
  }

  await TicketMessage.deleteMany({ ticketId: id });
  await Review.deleteMany({ ticketId: id });
  await Ticket.deleteOne({ id });
  await deleteMedia(ticket.mediaData);
  await deleteMedia(ticket.completionMediaData);
  if (isAdmin) {
    await createAdminActivity({
      adminUser: req.user,
      sessionLabel: req.sessionLabel,
      action: 'Ticket Deleted',
      targetType: 'ticket',
      targetId: ticket.id,
      summary: `Deleted ticket ${ticket.ticketCode} with status ${ticket.status}.`,
      details: await ticketActivityDetails(ticket),
    });
  }

  res.json({ message: 'Ticket deleted.' });
});

app.get('/api/tickets/:id/messages', authMiddleware, async (req, res) => {
  const id = parseNumericId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ticket id.' });
  const ticket = await Ticket.findOne({ id }).lean();
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ message: 'No permission to view this conversation.' });
  }

  const messages = await TicketMessage.find({ ticketId: id }).sort({ createdAt: 1 }).limit(200);
  return res.json(messages.map((message) => cleanRecord(message)));
});

app.post('/api/tickets/:id/messages', authMiddleware, ticketMessageLimiter, async (req, res) => {
  const id = parseNumericId(req.params.id);
  const messageText = cleanBoundedText(req.body?.message, 1000);
  if (!id) return res.status(400).json({ message: 'Invalid ticket id.' });
  if (!messageText) return res.status(400).json({ message: 'Message is required (max 1000 characters).' });
  const ticket = await Ticket.findOne({ id }).lean();
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ message: 'No permission to message on this ticket.' });
  }

  const message = await TicketMessage.create({
    id: await nextId('ticketMessages'),
    ticketId: id,
    senderId: req.user.id,
    senderRole: req.user.role,
    message: messageText,
    readBy: [req.user.id],
    createdAt: new Date(),
  });
  const recipientIds = new Set();
  if (req.user.id !== ticket.userId) recipientIds.add(ticket.userId);
  if (ticket.workerId && req.user.id !== ticket.workerId) recipientIds.add(ticket.workerId);
  if (req.user.role !== 'admin') {
    const admins = await User.find({ role: 'admin' }, { id: 1 }).lean();
    admins.forEach((admin) => recipientIds.add(admin.id));
  }
  await Promise.all(
    [...recipientIds].map((userId) =>
      createNotification({
        userId,
        title: `New message on ${ticket.ticketCode}`,
        message: `${req.user.firstName}: ${truncateText(messageText, 120)}`,
      }),
    ),
  );
  return res.status(201).json(cleanRecord(message));
});

app.post('/api/tickets/:id/review', authMiddleware, requireRoles('user'), async (req, res) => {
  const id = parseNumericId(req.params.id);
  const rating = Number(req.body?.rating);
  const comment = String(req.body?.comment ?? '').trim();
  if (!id) return res.status(400).json({ message: 'Invalid ticket id.' });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 500) {
    return res.status(400).json({ message: 'Rating must be 1 to 5 and comment at most 500 characters.' });
  }
  const ticket = await Ticket.findOne({ id }).lean();
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  if (ticket.userId !== req.user.id) {
    return res.status(403).json({ message: 'Only the requester can review this ticket.' });
  }
  if (ticket.status !== 'completed' || !ticket.workerId) {
    return res.status(409).json({ message: 'Only completed worker tickets can be reviewed.' });
  }
  if (await Review.exists({ ticketId: id })) {
    return res.status(409).json({ message: 'This ticket has already been reviewed.' });
  }

  const review = await Review.create({
    id: await nextId('reviews'),
    ticketId: id,
    userId: req.user.id,
    workerId: ticket.workerId,
    rating,
    comment,
    createdAt: new Date(),
  });
  fastCache.invalidate(`reviews:${ticket.workerId}`);
  await createNotification({
    userId: ticket.workerId,
    title: 'New Worker Rating',
    message: `${ticket.ticketCode} received a ${rating}-star rating.`,
  });
  return res.status(201).json(cleanRecord(review));
});

app.get('/api/workers/:id/reviews', authMiddleware, async (req, res) => {
  const workerId = parseNumericId(req.params.id);
  if (!workerId) return res.status(400).json({ message: 'Invalid worker id.' });
  const cacheKey = `reviews:${workerId}`;
  const cached = fastCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  const [summary] = await Review.aggregate([
    { $match: { workerId } },
    { $group: { _id: '$workerId', ratingAverage: { $avg: '$rating' }, ratingCount: { $sum: 1 } } },
  ]);
  const reviews = await Review.find({ workerId }).sort({ createdAt: -1 }).limit(20);
  const payload = {
    ratingAverage: summary?.ratingAverage ?? 0,
    ratingCount: summary?.ratingCount ?? 0,
    reviews: reviews.map((review) => cleanRecord(review)),
  };
  fastCache.set(cacheKey, payload, 30000);
  return res.json(payload);
});

app.get('/api/notifications', authMiddleware, async (req, res) => {
  const notifications = await Notification.find({
    $or: [
      { userId: req.user.id },
      { userId: null, targetRole: null },
      { userId: null, targetRole: req.user.role },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json(
    notifications.map((item) => {
      const record = cleanRecord(item);
      const readBy = Array.isArray(record.readBy) ? record.readBy : [];
      delete record.readBy;
      return {
        ...record,
        read: readBy.includes(req.user.id),
      };
    }),
  );
});

app.post('/api/notifications', authMiddleware, requireRoles('admin'), async (req, res) => {
  const { title, message, userId = null, targetRole = null } = req.body ?? {};
  const cleanTitle = cleanBoundedText(title, 200);
  const cleanMessage = cleanBoundedText(message, 1_000);
  const targetUserId = userId === null || userId === '' ? null : parseNumericId(userId);
  const cleanTargetRole = typeof targetRole === 'string' ? targetRole.trim() : '';
  if (
    !cleanTitle ||
    !cleanMessage ||
    (userId !== null && userId !== '' && !targetUserId) ||
    (targetUserId && cleanTargetRole) ||
    (cleanTargetRole && !isNotificationTargetRole(cleanTargetRole))
  ) {
    return res.status(400).json({ message: 'Notification fields are invalid or too long.' });
  }
  if (targetUserId && !(await User.exists({ id: targetUserId }))) {
    return res.status(404).json({ message: 'Notification recipient not found.' });
  }

  if (cleanTargetRole) {
    await createNotification({
      targetRole: cleanTargetRole,
      title: cleanTitle,
      message: cleanMessage,
    });
  } else {
    await createNotification({ title: cleanTitle, message: cleanMessage, userId: targetUserId });
  }

  await createAdminActivity({
    adminUser: req.user,
    sessionLabel: req.sessionLabel,
    action: 'Notification Sent',
    targetType: targetUserId
      ? 'targeted-notification'
      : cleanTargetRole
        ? `${cleanTargetRole}-notification`
        : 'broadcast-notification',
    targetId: targetUserId,
    summary: `Sent notification "${cleanTitle}"${
      targetUserId
        ? ` to user #${targetUserId}`
        : cleanTargetRole
          ? ` to all ${cleanTargetRole}s`
          : ' to all users'
    }.`,
  });

  res.status(201).json({ message: 'Notification sent.' });
});

app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  const id = parseNumericId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid notification id.' });
  }

  const notification = await Notification.findOne({
    id,
    $or: [
      { userId: req.user.id },
      { userId: null, targetRole: null },
      { userId: null, targetRole: req.user.role },
    ],
  });

  if (!notification) {
    return res.status(404).json({ message: 'Notification not found.' });
  }

  if (!Array.isArray(notification.readBy)) {
    notification.readBy = [];
  }

  if (!notification.readBy.includes(req.user.id)) {
    notification.readBy.push(req.user.id);
    await notification.save();
  }

  const record = cleanRecord(notification);
  const readBy = Array.isArray(record.readBy) ? record.readBy : [];
  delete record.readBy;

  res.json({
    ...record,
    read: readBy.includes(req.user.id),
  });
});

app.put('/api/notifications/read-all', authMiddleware, async (req, res) => {
  const result = await Notification.updateMany(
    {
      $or: [
        { userId: req.user.id },
        { userId: null, targetRole: null },
        { userId: null, targetRole: req.user.role },
      ],
      readBy: { $ne: req.user.id },
    },
    { $addToSet: { readBy: req.user.id } },
  );

  res.json({
    message: 'All notifications marked as read.',
    updated: Number(result?.modifiedCount ?? result?.nModified ?? 0),
  });
});

app.get('/api/admin-activities', authMiddleware, requireRoles('admin'), async (_req, res) => {
  const activities = await AdminActivity.find().sort({ createdAt: -1 }).limit(100);
  res.json(activities.map((activity) => cleanRecord(activity)));
});

app.use((error, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ message: 'Internal server error.' });
});

const MONGO_OPTIONS = {
  maxPoolSize: 50,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

async function bootstrap() {
  if (isD1PartiallyConfigured()) {
    throw new Error('CF_ACCOUNT_ID, CF_D1_DATABASE_ID, and CF_API_TOKEN must be set together.');
  }
  await mongoose.connect(MONGO_URI, MONGO_OPTIONS);
  let d1Initialized = false;
  if (isD1Configured()) {
    d1Initialized = await initD1Tables();
  }
  if (locationConn) {
    try {
      await Promise.race([
        locationConn.asPromise(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Secondary connection timeout')), 5000)),
      ]);
      isLocationConnHealthy = true;
    } catch (err) {
      isLocationConnHealthy = false;
      console.warn('[db] Secondary connection could not be established:', err.message);
    }
  }
  auxiliaryStore = selectAuxiliaryStore({
    d1Configured: isD1Configured(),
    d1Initialized,
    secondaryConfigured: Boolean(WORKER_LOCATION_MONGO_URI),
    secondaryReady: Boolean(isLocationConnHealthy && locationConn?.readyState === 1),
  });
  if (!auxiliaryStore) {
    throw new Error('Configured GPS/chat store is unavailable; refusing to split data across stores.');
  }
  console.log(`[db] GPS and chat store selected: ${auxiliaryStore}`);
  if (auxiliaryStore === 'd1') {
    await D1WorkerLocation.deleteExpired();
    d1CleanupTimer = setInterval(() => {
      void D1WorkerLocation.deleteExpired().catch((error) => {
        console.warn('[d1] Expired location cleanup failed:', error.message);
      });
    }, 60_000);
    d1CleanupTimer.unref?.();
  }
  await seedData();
  await migrateTicketLifecycle();

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Smart Waste API running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  try {
    await bootstrap();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start Smart Waste API', error);
    process.exit(1);
  }
}

export {
  app,
  bootstrap,
  deletedIdentityFilter,
  firebaseIdentity,
  isAllowedOrigin,
  normalizeAccountProfile,
  publicWorkerProfile,
  selectAuxiliaryStore,
};
