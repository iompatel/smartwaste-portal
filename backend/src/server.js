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
  WORKER_NEARBY_DISTANCE_METERS,
  WORKER_LOCATION_TTL_MS,
  distanceMeters,
  isFreshWorkerLocation,
  normalizeCoordinates,
  normalizeWorkerLocation,
} from './location-policy.js';
import { photonSuggestions } from './geocoding.js';
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
import { registerAuthRoutes } from './routes/auth.js';
import { registerAccountRoutes } from './routes/accounts.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerTicketRoutes } from './routes/tickets.js';
import { registerNotificationRoutes } from './routes/notifications.js';

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
    locationLatitude: { type: Number, default: null, min: -90, max: 90 },
    locationLongitude: { type: Number, default: null, min: -180, max: 180 },
    arrivalNotifiedAt: { type: Date, default: null },
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
    const workerProfile = viewer?.role === 'admin' || viewer?.id === worker?.id
      ? sanitizeUser(worker)
      : viewer?.role === 'user' && viewer.id === record.userId && worker
        ? {
            ...publicWorkerProfile(worker),
            mobile: /^\d{10,15}$/.test(String(worker.mobile ?? '')) ? String(worker.mobile) : '',
          }
        : publicWorkerProfile(worker);
    return {
      ...record,
      slaDueAt,
      slaOverdue: !isClosedTicket(record.status) && slaDueAt.getTime() < Date.now(),
      requester: requester ? sanitizeUser(requester) : null,
      assignedWorker: workerProfile,
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
      { id: 1, firstName: 1, lastName: 1, mobile: 1, workerSkills: 1 },
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
      { id: 1, firstName: 1, lastName: 1, mobile: 1, workerSkills: 1 },
    ).lean();
    fastCache.set('workers:online', workers, 5000);
  }
  const freeWorkers = workers
    .map((w) => ({
      id: Number(w.id),
      firstName: String(w.firstName ?? ''),
      lastName: String(w.lastName ?? ''),
      mobile: String(w.mobile ?? ''),
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
      const selectedWorker = freeWorkers.find((worker) => worker.id === selectedWorkerId);
      const workerName = `${selectedWorker?.firstName ?? ''} ${selectedWorker?.lastName ?? ''}`.trim() || `Worker #${selectedWorkerId}`;
      await Promise.all([
        createNotification({
          userId: selectedWorkerId,
          title: 'New Ticket Assigned',
          message: buildTicketDetailsMessage(updated, requester),
        }),
        createNotification({
          userId: updated.userId,
          title: 'Worker Assigned',
          message: `${updated.ticketCode} was assigned to ${workerName} (ID ${selectedWorkerId}${selectedWorker?.mobile ? `, ${selectedWorker.mobile}` : ''}).`,
        }),
      ]);
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

const KNOWN_PROJECT_ORIGINS = [
  'https://smartwasteportal.onrender.com',
  'https://smartwasteworker.onrender.com',
  'https://smartwaste-worker.onrender.com',
  'https://smartwasteadmin.onrender.com',
  'https://smartwaste-admin.onrender.com',
  'https://worker.smartwaste.dpdns.org',
  'https://admin.smartwaste.dpdns.org',
  'https://smartwaste.dpdns.org',
];

const allowedOrigins = new Set(
  [
    ...KNOWN_PROJECT_ORIGINS,
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

const addressSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `address:${req.user?.id ?? authClientIp(req)}`,
  validate: { ip: false, keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many address searches. Please pause and try again.' },
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
  const sanitized = sanitizeUser(user);
  return res.json({
    token,
    user: sanitized,
    ...(user.role === 'worker' ? { worker: sanitized } : {}),
  });
}

async function handlePasswordLogin(req, res, portal) {
  const { email, password, id, identifier: rawId } = req.body ?? {};
  const identifier = String(email ?? id ?? rawId ?? '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const numericId = parseNumericId(identifier);
  const normalizedEmail = normalizeEmail(identifier);

  if (portal === 'public' && isFirebaseEnabled()) {
    try {
      if (await getFirebaseUserByEmail(normalizedEmail)) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }
    } catch {
      return res.status(503).json({ message: 'Authentication service is temporarily unavailable.' });
    }
  }

  const query = numericId
    ? { $or: [{ id: numericId }, { email: normalizedEmail }] }
    : { email: normalizedEmail };

  const user = await User.findOne(query);
  if (!user || user.disabled || !(await comparePassword(String(password), user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email, ID, or password.' });
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

const routeContext = {
  AccountActivity,
  AdminActivity,
  AdminSession,
  Counter,
  DeletedIdentity,
  HireRequest,
  Notification,
  PASSWORD_POLICY_MESSAGE,
  PENDING_REGISTRATION_TTL_MS,
  PendingRegistration,
  Review,
  TICKET_PRIORITIES,
  Ticket,
  TicketMessage,
  USER_ROLES,
  User,
  WORKER_LOCATION_TTL_MS,
  WORKER_NEARBY_DISTANCE_METERS,
  WorkerLocation,
  accountActivitySnapshot,
  accountWriteGuard,
  addressSearchLimiter,
  activityDateRange,
  activityQuery,
  appendTicketStatus,
  authMiddleware,
  autoAssignUnassignedTickets,
  buildTicketDetailsMessage,
  buildTicketRecords,
  canAccessTicket,
  canUseLoginPortal,
  canWorkerTransition,
  cleanBoundedText,
  cleanRecord,
  clearAdminCookie,
  createAccountActivity,
  createAdminActivity,
  createAdminSecret,
  createCompletionCode,
  createNotification,
  deleteFirebaseUser,
  deleteMedia,
  deletedIdentityFilter,
  fastCache,
  firebaseIdentity,
  firebaseProviderFromRecord,
  firebaseRecordForUser,
  handleAdminLogin,
  handlePasswordLogin,
  hashAdminSecret,
  hashPassword,
  isClosedTicket,
  isFirebaseEnabled,
  isFreshWorkerLocation,
  isNotificationTargetRole,
  isStrongPassword,
  isValidImageData,
  isValidProfileImage,
  matchesAdminSecret,
  nextAccountTimestamp,
  nextId,
  normalizeAccountProfile,
  normalizeCoordinates,
  normalizeEmail,
  normalizeWorkerLocation,
  parseNumericId,
  photonSuggestions,
  pickFreeWorkerIdForTicket,
  publicWorkerProfile,
  requireRoles,
  sanitizeUser,
  sendLoginResponse,
  ticketActivityDetails,
  ticketCreateLimiter,
  ticketMessageLimiter,
  truncateText,
  updateFirebaseUser,
  uploadMedia,
  distanceMeters,
  usesFirebasePasswordProvider,
  verifyFirebaseIdToken,
};

registerAuthRoutes(app, routeContext);
registerAccountRoutes(app, routeContext);
registerAdminRoutes(app, routeContext);
registerTicketRoutes(app, routeContext);
registerNotificationRoutes(app, routeContext);


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
