export function registerAccountRoutes(app, ctx) {
  const {
    Ticket,
    User,
    WORKER_LOCATION_TTL_MS,
    WorkerLocation,
    accountActivitySnapshot,
    authMiddleware,
    autoAssignUnassignedTickets,
    canAccessTicket,
    cleanBoundedText,
    cleanRecord,
    createAccountActivity,
    createAdminActivity,
    deleteMedia,
    fastCache,
    isFreshWorkerLocation,
    isValidProfileImage,
    normalizeWorkerLocation,
    parseNumericId,
    requireRoles,
    sanitizeUser,
    uploadMedia,
  } = ctx;

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

}
