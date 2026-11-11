import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import mongoose from 'mongoose';

import {
  createFirebaseUser,
  getFirebaseUserByEmail,
  isFirebaseEnabled,
  verifyFirebaseIdToken,
} from './firebase-admin.js';
import {
  PASSWORD_POLICY_MESSAGE,
  canUseLoginPortal,
  isStrongPassword,
} from './auth-policy.js';
import {
  adminCookieName,
  adminSessionTtlMs,
  createAdminSecret,
  hashAdminSecret,
  matchesAdminSecret,
  readCookie,
} from './admin-session.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required.');
}

const PORT = Number(process.env.PORT ?? 4000);
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/smart_waste_portal';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SERVICE_MODE = process.env.SERVICE_MODE ?? (IS_PRODUCTION ? 'public' : 'combined');
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
const SEED_ADMIN_EMAIL = normalizeEmail(process.env.SEED_ADMIN_EMAIL ?? 'admin@smartwaste.com');
const SEED_ADMIN_PASSWORD = String(process.env.SEED_ADMIN_PASSWORD ?? '');
const SEED_DEMO_USERS = process.env.SEED_DEMO_USERS === 'true' || !IS_PRODUCTION;

if (IS_PRODUCTION && PUBLIC_AUTH_ENABLED && !process.env.PUBLIC_FRONTEND_URL) {
  throw new Error('PUBLIC_FRONTEND_URL is required by the public backend.');
}
if (IS_PRODUCTION && ADMIN_AUTH_ENABLED && !process.env.ADMIN_FRONTEND_URL) {
  throw new Error('ADMIN_FRONTEND_URL is required by the admin backend.');
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
const TICKET_STATUSES = ['pending', 'in_progress', 'completed'];
const TICKET_PRIORITIES = ['low', 'medium', 'high'];
const HIRE_REQUEST_STATUSES = ['pending', 'assigned', 'completed', 'cancelled'];

const SALT_ROUNDS = 10;
const DEMO_PASSWORDS = {
  'worker@smartwaste.com': 'Worker#123',
  'user@smartwaste.com': 'User#123',
};
const LEGACY_DEMO_PASSWORDS = {
  'worker@smartwaste.com': 'worker123',
  'user@smartwaste.com': 'user123',
};
const LEGACY_ADMIN_PASSWORDS = ['admin123', 'Admin#123'];

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
  // Project no longer stores/exposes coordinates; keep address-only location.
  delete source.latitude;
  delete source.longitude;
  return source;
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const safe = cleanRecord(user);
  delete safe.passwordHash;
  return safe;
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function parseNumericId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
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
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    gender: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: USER_ROLES },
    address: { type: String, required: true, trim: true },
    profileImage: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },
  },
  { versionKey: false, collection: 'users' },
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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'tickets' },
);

const notificationSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: Number, default: null },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    readBy: { type: [Number], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'notifications' },
);

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

const Counter = mongoose.model('Counter', counterSchema);
const User = mongoose.model('User', userSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const AdminActivity = mongoose.model('AdminActivity', adminActivitySchema);
const HireRequest = mongoose.model('HireRequest', hireRequestSchema);
const AdminSession = mongoose.model('AdminSession', adminSessionSchema);

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
  const current = await Counter.findOne({ key }).lean();

  if (!current || current.value < highestId) {
    await Counter.findOneAndUpdate(
      { key },
      { key, value: highestId },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
}

async function createNotification({ userId = null, title, message }) {
  const notification = await Notification.create({
    id: await nextId('notifications'),
    userId,
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

  return cleanRecord(activity);
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

async function pickFreeWorkerIdForTicket() {
  const workers = await User.find({ role: 'worker' }, { id: 1 }).lean();
  const workerIds = workers
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
        status: { $ne: 'completed' },
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
  const workers = await User.find({ role: 'worker' }, { id: 1 }).lean();
  const freeIds = workers
    .map((worker) => Number(worker.id))
    .filter((id) => Number.isFinite(id) && id > 0 && !busy.has(id));

  if (!freeIds.length) {
    return 0;
  }

  const tickets = await Ticket.find({ workerId: null, status: { $ne: 'completed' } })
    .sort({ createdAt: 1 })
    .limit(limit);

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
    const workerId = await pickFreeWorkerIdForTicket();
    if (!workerId) {
      break;
    }

    const updated = await Ticket.findOneAndUpdate(
      { id: ticket.id, workerId: null },
      { $set: { workerId, updatedAt: new Date() } },
      { new: true },
    );

    if (updated) {
      assigned += 1;
      const requester = requesterMap.get(Number(updated.userId));
      await createNotification({
        userId: workerId,
        title: 'New Ticket Assigned',
        message: buildTicketDetailsMessage(updated, requester),
      });
    }
  }

  return assigned;
}

function defaultPasswordForKnownDemoUsers(email) {
  const normalizedEmail = normalizeEmail(email);

  return (
    DEMO_PASSWORDS[normalizedEmail] ??
    `Temp#${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 6)}`
  );
}

async function upgradeLegacyDemoPasswords() {
  for (const [email, legacyPassword] of Object.entries(LEGACY_DEMO_PASSWORDS)) {
    const user = await User.findOne({ email });
    if (user && (await comparePassword(legacyPassword, user.passwordHash))) {
      user.passwordHash = await hashPassword(DEMO_PASSWORDS[email]);
      user.updatedAt = new Date();
      await user.save();
    }
  }
}

async function ensureSeedAdmin() {
  if (!SEED_ADMIN_PASSWORD) {
    if ((await User.countDocuments({ role: 'admin' })) === 0) {
      // eslint-disable-next-line no-console
      console.warn('No admin exists. Set SEED_ADMIN_PASSWORD once to bootstrap one.');
    }
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

    for (const legacyPassword of LEGACY_ADMIN_PASSWORDS) {
      if (await comparePassword(legacyPassword, existing.passwordHash)) {
        existing.passwordHash = await hashPassword(SEED_ADMIN_PASSWORD);
        existing.updatedAt = new Date();
        await existing.save();
        break;
      }
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

async function ensureUserExistsInFirebase(localUser) {
  if (!localUser || !isFirebaseEnabled()) {
    return;
  }

  const existing = await getFirebaseUserByEmail(localUser.email);
  if (existing) {
    return;
  }

  const displayName = `${localUser.firstName} ${localUser.lastName}`.trim();
  await createFirebaseUser({
    email: localUser.email,
    password: defaultPasswordForKnownDemoUsers(localUser.email),
    displayName: displayName || 'Smart Waste User',
  });
}

async function syncDefaultDemoUsersToFirebase() {
  if (!PUBLIC_AUTH_ENABLED || !SEED_DEMO_USERS || !isFirebaseEnabled()) {
    return;
  }

  const emails = ['worker@smartwaste.com', 'user@smartwaste.com'];
  for (const email of emails) {
    const localUser = await User.findOne({ email }).lean();
    if (!localUser) {
      continue;
    }

    try {
      await ensureUserExistsInFirebase(localUser);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to sync Firebase demo user: ${email}`, error?.message ?? error);
    }
  }
}

async function seedData() {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    if (PUBLIC_AUTH_ENABLED) {
      await upgradeLegacyDemoPasswords();
    }
    if (ADMIN_AUTH_ENABLED) {
      await ensureSeedAdmin();
    }
    await Promise.all([
      syncCounter('users', User),
      syncCounter('tickets', Ticket),
      syncCounter('hireRequests', HireRequest),
      syncCounter('notifications', Notification),
      syncCounter('adminActivities', AdminActivity),
    ]);
    return;
  }

  if (ADMIN_AUTH_ENABLED) {
    await ensureSeedAdmin();
  }

  if (!PUBLIC_AUTH_ENABLED || !SEED_DEMO_USERS) {
    await syncCounter('users', User);
    return;
  }

  const now = new Date();
  const workerUser = {
    id: await nextId('users'),
    firstName: 'Field',
    lastName: 'Worker',
    gender: 'Male',
    mobile: '8888888888',
    email: 'worker@smartwaste.com',
    passwordHash: await hashPassword(DEMO_PASSWORDS['worker@smartwaste.com']),
    role: 'worker',
    address: 'North Sector',
    profileImage: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };

  const citizenUser = {
    id: await nextId('users'),
    firstName: 'Citizen',
    lastName: 'User',
    gender: 'Female',
    mobile: '7777777777',
    email: 'user@smartwaste.com',
    passwordHash: await hashPassword(DEMO_PASSWORDS['user@smartwaste.com']),
    role: 'user',
    address: 'Lakeview Block',
    profileImage: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };

  await User.insertMany([workerUser, citizenUser]);

  await Ticket.insertMany([
    {
      id: await nextId('tickets'),
      ticketCode: 'SWM-1001',
      userId: citizenUser.id,
      workerId: workerUser.id,
      wasteType: 'Mixed Waste',
      description: 'Overflowing waste at bus stop near market gate.',
      mediaData: null,
      locationAddress: 'Bus Stop, Central Market',
      status: 'in_progress',
      priority: 'high',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: await nextId('tickets'),
      ticketCode: 'SWM-1002',
      userId: citizenUser.id,
      workerId: null,
      wasteType: 'Dry Waste',
      description: 'Plastic bags dumped near community park entrance.',
      mediaData: null,
      locationAddress: 'Community Park, Lakeview',
      status: 'pending',
      priority: 'medium',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await Notification.create({
    id: await nextId('notifications'),
    userId: citizenUser.id,
    title: 'Welcome to Smart Waste',
    message: 'Track and report waste issues in real-time.',
    createdAt: now,
  });

  await Promise.all([
    syncCounter('users', User),
    syncCounter('tickets', Ticket),
    syncCounter('hireRequests', HireRequest),
    syncCounter('notifications', Notification),
    syncCounter('adminActivities', AdminActivity),
  ]);
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

app.use((req, res, next) => {
  const origin = String(req.headers.origin ?? '').replace(/\/$/, '');
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ message: 'Origin is not allowed.' });
  }
  return next();
});
app.use((req, res, next) => {
  if (!ADMIN_EDGE_SECRET_HASH || !ADMIN_AUTH_ENABLED || !IS_PRODUCTION) {
    return next();
  }
  if (req.path === '/api/health') {
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
      const normalized = String(origin ?? '').replace(/\/$/, '');
      callback(null, !origin || allowedOrigins.has(normalized));
    },
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Admin-CSRF'],
  }),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many admin login attempts. Try again later.' },
});

app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', (req, res, next) => {
  if (!ADMIN_AUTH_ENABLED && req.path === '/admin-login') {
    return res.status(404).json({ message: 'Not found.' });
  }
  if (!PUBLIC_AUTH_ENABLED && !['/admin-login', '/logout'].includes(req.path)) {
    return res.status(404).json({ message: 'Not found.' });
  }
  return next();
});
app.use('/api/auth/admin-login', adminAuthLimiter);
app.use('/api/auth', authLimiter);

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
  if (!user) {
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

    if (!user) {
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

  const token = generateToken(user);
  return res.json({ token, user: sanitizeUser(user) });
}

async function handlePasswordLogin(req, res, portal) {
  const { email, password } = req.body ?? {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !(await comparePassword(String(password), user.passwordHash))) {
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
  if (!user || user.role !== 'admin' || !passwordValid) {
    return res.status(401).json({ message: 'Invalid admin credentials.' });
  }

  if (LEGACY_ADMIN_PASSWORDS.includes(String(password))) {
    return res.status(403).json({
      message: 'This public demo password is disabled. Set SEED_ADMIN_PASSWORD and restart once.',
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
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ready' : 'unavailable',
    time: new Date().toISOString(),
    database: connected ? 'mongodb-connected' : 'mongodb-disconnected',
  });
});

app.post('/api/auth/signup', async (req, res) => {
  const {
    firstName,
    lastName,
    gender,
    mobile,
    email,
    password,
    address,
    profileImage = null,
  } = req.body ?? {};

  if (!firstName || !lastName || !mobile || !email || !password || !address) {
    return res.status(400).json({ message: 'Please fill all mandatory fields.' });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }

  // Public signup can create only the "user" role.
  const allowedRole = 'user';
  const existing = await User.findOne({ email: normalizedEmail }, { id: 1 }).lean();
  if (existing) {
    return res.status(409).json({ message: 'Email already registered.' });
  }

  const now = new Date();
  const user = await User.create({
    id: await nextId('users'),
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    gender: String(gender ?? 'Other').trim(),
    mobile: String(mobile).trim(),
    email: normalizedEmail,
    passwordHash: await hashPassword(String(password)),
    role: allowedRole,
    address: String(address).trim(),
    profileImage,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  });

  const token = generateToken(user);

  await createNotification({
    userId: user.id,
    title: 'Account Created',
    message: 'Welcome to Smart Waste Management System.',
  });

  return res.status(201).json({ token, user: sanitizeUser(user) });
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
  if (!email) {
    return res.status(400).json({ message: 'No email found in Firebase token.' });
  }

  let user = await User.findOne({ email });
  if (user && !canUseLoginPortal(user.role, 'public')) {
    return res.status(403).json({
      message:
        user.role === 'admin'
          ? 'Admin accounts must use the Admin Console.'
          : 'Worker accounts must use the Worker Console.',
    });
  }

  if (!user) {
    const now = new Date();
    const fullName = String(decoded.name ?? '').trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const derivedFirstName = nameParts[0] ?? 'Firebase';
    const derivedLastName = nameParts.slice(1).join(' ') || 'User';

    user = await User.create({
      id: await nextId('users'),
      firstName: String(firstName ?? derivedFirstName).trim(),
      lastName: String(lastName ?? derivedLastName).trim(),
      gender: String(gender).trim(),
      mobile: String(mobile).trim(),
      email,
      passwordHash: await hashPassword(`firebase:${decoded.uid}`),
      role: 'user',
      address: String(address).trim(),
      profileImage: profileImage ?? decoded.picture ?? null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    });

    await createNotification({
      userId: user.id,
      title: 'Account Created',
      message: 'Welcome to Smart Waste Management System.',
    });
  }

  return sendLoginResponse(user, res);
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const user = await User.findOne({ email, role: 'user' }).lean();

  try {
    if (user) {
      await ensureUserExistsInFirebase(user);
    }
  } catch {
    return res.status(500).json({ message: 'Unable to prepare reset for this account.' });
  }

  if (user) {
    await createNotification({
      userId: user.id,
      title: 'Password Reset Requested',
      message: 'Password reset requested. Check your email inbox and spam folder.',
    });
  }

  return res.json({ message: 'If email exists, reset instructions were sent.' });
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
  }

  return res.json({ message: 'Logged out successfully.' });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

app.put('/api/me', authMiddleware, async (req, res) => {
  const { firstName, lastName, gender, mobile, address, profileImage } = req.body ?? {};
  const now = new Date();

  await User.updateOne(
    { id: req.user.id },
    {
      $set: {
        firstName: String(firstName ?? req.user.firstName),
        lastName: String(lastName ?? req.user.lastName),
        gender: String(gender ?? req.user.gender),
        mobile: String(mobile ?? req.user.mobile),
        address: String(address ?? req.user.address),
        profileImage: profileImage ?? req.user.profileImage ?? null,
        updatedAt: now,
      },
    },
  );

  const user = await User.findOne({ id: req.user.id });
  if (req.user.role === 'admin') {
    await createAdminActivity({
      adminUser: user,
      sessionLabel: req.sessionLabel,
      action: 'Profile Updated',
      targetType: 'admin',
      targetId: req.user.id,
      summary: 'Updated admin profile details.',
    });
  }

  return res.json(sanitizeUser(user));
});

app.get('/api/dashboard/summary', authMiddleware, async (_req, res) => {
  const [totalUsers, totalWorkers, totalTickets, pendingTickets] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'worker' }),
    Ticket.countDocuments(),
    Ticket.countDocuments({ status: 'pending' }),
  ]);

  res.json({
    totalUsers,
    totalWorkers,
    totalTickets,
    pendingTickets,
  });
});

app.get('/api/users', authMiddleware, requireRoles('admin'), async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users.map((user) => sanitizeUser(user)));
});

app.post('/api/users', authMiddleware, requireRoles('admin'), async (req, res) => {
  const {
    firstName,
    lastName,
    gender,
    mobile,
    email,
    password,
    role,
    address,
    profileImage = null,
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

  if (!isStrongPassword(password)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }

  const existing = await User.findOne({ email: normalizedEmail }, { id: 1 }).lean();
  if (existing) {
    return res.status(409).json({ message: 'Email already exists.' });
  }

  const now = new Date();
  const user = await User.create({
    id: await nextId('users'),
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    gender: String(gender ?? 'Other').trim(),
    mobile: String(mobile).trim(),
    email: normalizedEmail,
    passwordHash: await hashPassword(String(password)),
    role: allowedRole,
    address: String(address).trim(),
    profileImage,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  });

  await createAdminActivity({
    adminUser: req.user,
    sessionLabel: req.sessionLabel,
    action: 'Account Created',
    targetType: allowedRole,
    targetId: user.id,
    summary: `Created ${allowedRole} account for ${user.firstName} ${user.lastName}.`,
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

  const role = req.body?.role ?? existing.role;
  if (!USER_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  const nextEmail = normalizeEmail(req.body?.email ?? existing.email);
  const duplicate = await User.findOne({ email: nextEmail, id: { $ne: id } }, { id: 1 }).lean();
  if (duplicate) {
    return res.status(409).json({ message: 'Email already exists.' });
  }

  const previousRole = existing.role;
  existing.firstName = String(req.body?.firstName ?? existing.firstName);
  existing.lastName = String(req.body?.lastName ?? existing.lastName);
  existing.gender = String(req.body?.gender ?? existing.gender);
  existing.mobile = String(req.body?.mobile ?? existing.mobile);
  existing.email = nextEmail;
  existing.role = role;
  existing.address = String(req.body?.address ?? existing.address);
  existing.profileImage = req.body?.profileImage ?? existing.profileImage ?? null;
  existing.updatedAt = new Date();
  await existing.save();
  if (previousRole === 'admin' && existing.role !== 'admin') {
    await AdminSession.deleteMany({ userId: existing.id });
  }

  await createAdminActivity({
    adminUser: req.user,
    sessionLabel: req.sessionLabel,
    action: 'Account Updated',
    targetType: existing.role,
    targetId: existing.id,
    summary: `Updated ${existing.firstName} ${existing.lastName} account. Role ${previousRole} to ${existing.role}.`,
  });

  res.json(sanitizeUser(existing));
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

  await Promise.all([
    User.deleteOne({ id }),
    Ticket.deleteMany({ userId: id }),
    Ticket.updateMany({ workerId: id }, { $set: { workerId: null, updatedAt: new Date() } }),
    HireRequest.deleteMany({ userId: id }),
    HireRequest.updateMany(
      { assignedWorkerId: id, status: 'assigned' },
      {
        $set: {
          assignedWorkerId: null,
          status: 'pending',
          assignedByAdminId: null,
          assignedAt: null,
          completedAt: null,
          updatedAt: new Date(),
        },
      },
    ),
    Notification.deleteMany({ userId: id }),
    AdminSession.deleteMany({ userId: id }),
  ]);

  await createAdminActivity({
    adminUser: req.user,
    sessionLabel: req.sessionLabel,
    action: 'Account Deleted',
    targetType: user.role,
    targetId: user.id,
    summary: `Deleted ${user.role} account for ${user.firstName} ${user.lastName}.`,
  });

  return res.json({ message: 'User deleted.' });
});

app.get('/api/tickets', authMiddleware, async (req, res) => {
  const role = req.user.role;
  let rows = [];

  if (role === 'user') {
    rows = await Ticket.find({ userId: req.user.id }).sort({ updatedAt: -1 });
  } else if (role === 'worker') {
    const busy = await HireRequest.findOne(
      { assignedWorkerId: req.user.id, status: 'assigned' },
      { id: 1 },
    ).lean();

    if (busy) {
      return res.json([]);
    }

    // Attempt to distribute any unassigned tickets when a free worker opens the tickets view.
    await autoAssignUnassignedTickets(10);

    rows = await Ticket.find({ workerId: req.user.id }).sort({ updatedAt: -1 });
  } else {
    rows = await Ticket.find().sort({ updatedAt: -1 });
  }

  res.json(rows.map((ticket) => cleanRecord(ticket)));
});

app.get('/api/hire-requests', authMiddleware, async (req, res) => {
  const role = req.user.role;
  let rows = [];

  if (role === 'admin') {
    rows = await HireRequest.find().sort({ updatedAt: -1 });
  } else if (role === 'user') {
    rows = await HireRequest.find({ userId: req.user.id }).sort({ updatedAt: -1 });
  } else {
    rows = await HireRequest.find({ assignedWorkerId: req.user.id }).sort({ updatedAt: -1 });
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
  const workerMap = new Map(workers.map((worker) => [worker.id, sanitizeUser(worker)]));

  res.json(
    rows.map((request) => {
      const record = cleanRecord(request);
      return {
        ...record,
        assignedWorker:
          record.assignedWorkerId && workerMap.has(record.assignedWorkerId)
            ? workerMap.get(record.assignedWorkerId)
            : null,
      };
    }),
  );
});

app.post('/api/hire-requests', authMiddleware, requireRoles('user'), async (req, res) => {
  const { title, purpose, workAddress } = req.body ?? {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'Title is required.' });
  }

  if (!purpose || !String(purpose).trim()) {
    return res.status(400).json({ message: 'Purpose is required.' });
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
    title: String(title).trim(),
    purpose: String(purpose).trim(),
    workAddress: String(workAddress ?? req.user.address ?? '').trim(),
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
        message: `${requestCode} "${String(title).trim()}" from ${requesterName} (${req.user.mobile}). Purpose: ${String(
          purpose,
        ).trim()}.`,
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

    const request = await HireRequest.findOne({ id });
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
    if (!request.title) {
      request.title = 'Personal Work';
    }
    request.assignedWorkerId = workerId;
    request.assignedByAdminId = req.user.id;
    request.assignedAt = now;
    request.completedAt = null;
    request.status = 'assigned';
    request.updatedAt = now;
    await request.save();

    // When a worker is hired for personal work, they should not receive tickets.
    // Re-distribute any open tickets that were assigned to this worker.
    await Ticket.updateMany(
      { workerId, status: { $ne: 'completed' } },
      { $set: { workerId: null, updatedAt: now } },
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

    const request = await HireRequest.findOne({ id });
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
    if (!request.title) {
      request.title = 'Personal Work';
    }
    request.status = 'completed';
    request.completedAt = now;
    request.updatedAt = now;
    await request.save();

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

app.post('/api/tickets', authMiddleware, async (req, res) => {
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

  if (!wasteType || !description || !locationAddress) {
    return res.status(400).json({ message: 'Missing ticket fields.' });
  }

  const now = new Date();
  const ticket = await Ticket.create({
    id: await nextId('tickets'),
    ticketCode: `SWM-${Date.now().toString().slice(-6)}`,
    userId: req.user.id,
    workerId: null,
    wasteType: String(wasteType),
    description: String(description),
    mediaData,
    locationAddress: String(locationAddress),
    status: 'pending',
    priority: TICKET_PRIORITIES.includes(priority) ? priority : 'medium',
    createdAt: now,
    updatedAt: now,
  });

  const ticketDetailsMessage = buildTicketDetailsMessage(ticket, req.user);
  const assignedWorkerId = await pickFreeWorkerIdForTicket();
  if (assignedWorkerId) {
    ticket.workerId = assignedWorkerId;
    ticket.updatedAt = new Date();
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

  res.status(201).json(cleanRecord(ticket));
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
    const busy = await HireRequest.findOne(
      { assignedWorkerId: req.user.id, status: 'assigned' },
      { id: 1 },
    ).lean();
    if (busy) {
      return res.status(403).json({ message: 'Worker is currently assigned to a hired task.' });
    }

    if (ticket.workerId !== req.user.id) {
      return res.status(403).json({ message: 'This ticket is not assigned to you.' });
    }

    const status = req.body?.status;
    if (status === undefined) {
      return res.status(400).json({ message: 'Status is required.' });
    }

    if (!TICKET_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    if (status !== 'completed') {
      return res.status(400).json({ message: 'Workers can only mark tickets as completed.' });
    }

    const previousStatus = ticket.status;
    ticket.status = status;
    ticket.updatedAt = new Date();
    await ticket.save();

    if (ticket.status !== previousStatus) {
      await createNotification({
        userId: ticket.userId,
        title: 'Ticket Status Updated',
        message: `${ticket.ticketCode} is now ${ticket.status.replace('_', ' ')}.`,
      });
    }

    return res.json(cleanRecord(ticket));
  }

  if (req.body?.status !== undefined) {
    return res.status(403).json({ message: 'Only workers can update ticket status.' });
  }

  if (req.body?.workerId !== undefined) {
    return res.status(403).json({ message: 'Ticket assignment is automatic.' });
  }

  ticket.wasteType = String(req.body?.wasteType ?? ticket.wasteType);
  ticket.description = String(req.body?.description ?? ticket.description);
  ticket.mediaData = req.body?.mediaData ?? ticket.mediaData ?? null;
  ticket.locationAddress = String(req.body?.locationAddress ?? ticket.locationAddress);
  ticket.priority = TICKET_PRIORITIES.includes(req.body?.priority)
    ? req.body.priority
    : ticket.priority;
  ticket.updatedAt = new Date();
  await ticket.save();

  return res.json(cleanRecord(ticket));
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

  await Ticket.deleteOne({ id });
  if (isAdmin) {
    await createAdminActivity({
      adminUser: req.user,
      sessionLabel: req.sessionLabel,
      action: 'Ticket Deleted',
      targetType: 'ticket',
      targetId: ticket.id,
      summary: `Deleted ticket ${ticket.ticketCode} with status ${ticket.status}.`,
    });
  }

  res.json({ message: 'Ticket deleted.' });
});

app.get('/api/notifications', authMiddleware, async (req, res) => {
  const notifications = await Notification.find({
    $or: [{ userId: null }, { userId: req.user.id }],
  })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json(
    notifications.map((item) => {
      const record = cleanRecord(item);
      const readBy = Array.isArray(record.readBy) ? record.readBy : [];
      return {
        ...record,
        read: readBy.includes(req.user.id),
      };
    }),
  );
});

app.post('/api/notifications', authMiddleware, requireRoles('admin'), async (req, res) => {
  const { title, message, userId = null } = req.body ?? {};
  if (!title || !message) {
    return res.status(400).json({ message: 'Title and message are required.' });
  }

  await createNotification({ title, message, userId });
  await createAdminActivity({
    adminUser: req.user,
    sessionLabel: req.sessionLabel,
    action: 'Notification Sent',
    targetType: userId ? 'targeted-notification' : 'broadcast-notification',
    targetId: userId ? Number(userId) : null,
    summary: `Sent notification "${String(title).trim()}"${userId ? ` to user #${userId}` : ' to all users'}.`,
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
    $or: [{ userId: null }, { userId: req.user.id }],
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

  res.json({
    ...record,
    read: readBy.includes(req.user.id),
  });
});

app.put('/api/notifications/read-all', authMiddleware, async (req, res) => {
  const result = await Notification.updateMany(
    {
      $or: [{ userId: null }, { userId: req.user.id }],
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

async function bootstrap() {
  await mongoose.connect(MONGO_URI);
  await seedData();
  await syncDefaultDemoUsersToFirebase();

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Smart Waste API running on http://localhost:${PORT}`);
  });
}

try {
  await bootstrap();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Failed to start Smart Waste API', error);
  process.exit(1);
}
