export function registerAdminRoutes(app, ctx) {
  const {
    AccountActivity,
    AdminSession,
    Counter,
    DeletedIdentity,
    HireRequest,
    Notification,
    PASSWORD_POLICY_MESSAGE,
    PendingRegistration,
    Review,
    Ticket,
    TicketMessage,
    USER_ROLES,
    User,
    WorkerLocation,
    accountActivitySnapshot,
    accountWriteGuard,
    activityDateRange,
    activityQuery,
    authMiddleware,
    cleanRecord,
    createAdminActivity,
    deleteFirebaseUser,
    deleteMedia,
    fastCache,
    firebaseProviderFromRecord,
    firebaseRecordForUser,
    hashAdminSecret,
    hashPassword,
    isFirebaseEnabled,
    isFreshWorkerLocation,
    isStrongPassword,
    isValidProfileImage,
    nextAccountTimestamp,
    nextId,
    normalizeAccountProfile,
    normalizeEmail,
    parseNumericId,
    requireRoles,
    sanitizeUser,
    updateFirebaseUser,
    uploadMedia,
  } = ctx;

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
      id: 1, ticketCode: 1, workerId: 1, status: 1, locationAddress: 1, locationLatitude: 1, locationLongitude: 1,
    }).lean(),
  ]);
  const locationMap = new Map(locations.map((location) => [Number(location.workerId), location]));
  const ticketsByWorker = new Map();
  for (const ticket of tickets) {
    const workerTickets = ticketsByWorker.get(ticket.workerId) ?? [];
    workerTickets.push({
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      status: ticket.status,
      locationAddress: ticket.locationAddress,
      locationLatitude: ticket.locationLatitude ?? null,
      locationLongitude: ticket.locationLongitude ?? null,
    });
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
          latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy,
          heading: location.heading ?? null, speed: location.speed ?? null, updatedAt: location.updatedAt,
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

}
