import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  createFirebaseUser,
  getFirebaseUserByEmail,
  isFirebaseEnabled,
  verifyFirebaseIdToken,
} from './firebase-admin.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'smart-waste-demo-secret';
const PORT = Number(process.env.PORT ?? 4000);
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/smart_waste_portal';

const USER_ROLES = ['admin', 'worker', 'user'];
const TICKET_STATUSES = ['pending', 'in_progress', 'completed'];
const TICKET_PRIORITIES = ['low', 'medium', 'high'];
const HIRE_REQUEST_STATUSES = ['pending', 'assigned', 'completed', 'cancelled'];

function hashPassword(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
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

const Counter = mongoose.model('Counter', counterSchema);
const User = mongoose.model('User', userSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const AdminActivity = mongoose.model('AdminActivity', adminActivitySchema);
const HireRequest = mongoose.model('HireRequest', hireRequestSchema);

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
  const map = {
    'admin@smartwaste.com': 'admin123',
    'worker@smartwaste.com': 'worker123',
    'user@smartwaste.com': 'user123',
  };

  return (
    map[normalizedEmail] ??
    `Temp#${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 6)}`
  );
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
  if (!isFirebaseEnabled()) {
    return;
  }

  const emails = ['admin@smartwaste.com', 'worker@smartwaste.com', 'user@smartwaste.com'];
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
    await Promise.all([
      syncCounter('users', User),
      syncCounter('tickets', Ticket),
      syncCounter('hireRequests', HireRequest),
      syncCounter('notifications', Notification),
      syncCounter('adminActivities', AdminActivity),
    ]);
    return;
  }

  const now = new Date();

  const adminUser = {
    id: await nextId('users'),
    firstName: 'System',
    lastName: 'Admin',
    gender: 'Other',
    mobile: '9999999999',
    email: 'admin@smartwaste.com',
    passwordHash: hashPassword('admin123'),
    role: 'admin',
    address: 'City Control Room',
    profileImage: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };

  const workerUser = {
    id: await nextId('users'),
    firstName: 'Field',
    lastName: 'Worker',
    gender: 'Male',
    mobile: '8888888888',
    email: 'worker@smartwaste.com',
    passwordHash: hashPassword('worker123'),
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
    passwordHash: hashPassword('user123'),
    role: 'user',
    address: 'Lakeview Block',
    profileImage: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };

  await User.insertMany([adminUser, workerUser, citizenUser]);

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
app.use(cors());
app.use(express.json({ limit: '10mb' }));

async function authMiddleware(req, res, next) {
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

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'mongodb-connected' : 'mongodb-disconnected',
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

  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
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
    passwordHash: hashPassword(String(password)),
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
  const { email, password } = req.body ?? {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.passwordHash !== hashPassword(String(password))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = generateToken(user);
  const sessionLabel = buildSessionLabel(jwt.verify(token, JWT_SECRET));

  if (user.role === 'admin') {
    await createAdminActivity({
      adminUser: user,
      sessionLabel,
      action: 'Admin Login',
      targetType: 'session',
      summary: 'Signed in to the Smart Waste admin portal.',
    });
  }

  return res.json({ token, user: sanitizeUser(user) });
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

  try {
    const decoded = await verifyFirebaseIdToken(String(idToken));
    const email = normalizeEmail(decoded.email);

    if (!email) {
      return res.status(400).json({ message: 'No email found in Firebase token.' });
    }

    let user = await User.findOne({ email });

    if (!user) {
      const now = new Date();
      // Public Firebase login/signup can create only the "user" role.
      const allowedRole = 'user';
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
        passwordHash: hashPassword(`firebase:${decoded.uid}`),
        role: allowedRole,
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
    } else {
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = generateToken(user);
    const sessionLabel = buildSessionLabel(jwt.verify(token, JWT_SECRET));

    if (user.role === 'admin') {
      await createAdminActivity({
        adminUser: user,
        sessionLabel,
        action: 'Admin Login',
        targetType: 'session',
        summary: 'Signed in to the Smart Waste admin portal.',
      });
    }

    return res.json({ token, user: sanitizeUser(user) });
  } catch {
    return res.status(401).json({ message: 'Invalid Firebase token.' });
  }
});

app.post('/api/auth/google-demo', async (req, res) => {
  const email = normalizeEmail(req.body?.email ?? 'google.user@smartwaste.com');
  const now = new Date();
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      id: await nextId('users'),
      firstName: 'Google',
      lastName: 'User',
      gender: 'Other',
      mobile: '0000000000',
      email,
      passwordHash: hashPassword('google-login'),
      role: 'user',
      address: 'Google Auth User',
      profileImage: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    });
  } else {
    user.lastLoginAt = now;
    await user.save();
  }

  const token = generateToken(user);
  return res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const user = await User.findOne({ email }).lean();

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
    passwordHash: hashPassword(String(password)),
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
