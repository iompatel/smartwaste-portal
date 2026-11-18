export function registerAccountRoutes(app, ctx) {
  const {
    Ticket,
    User,
    WORKER_NEARBY_DISTANCE_METERS,
    WORKER_LOCATION_TTL_MS,
    WorkerLocation,
    accountActivitySnapshot,
    addressSearchLimiter,
    authMiddleware,
    autoAssignUnassignedTickets,
    buildTicketRecords,
    calculateBearing,
    canAccessTicket,
    cleanBoundedText,
    cleanRecord,
    createAccountActivity,
    createAdminActivity,
    createNotification,
    deleteMedia,
    distanceMeters,
    fastCache,
    isFreshWorkerLocation,
    isValidProfileImage,
    normalizeCoordinates,
    normalizeWorkerLocation,
    parseNumericId,
    photonSuggestions,
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

  const activeTickets = await Ticket.find(
    {
      workerId: req.user.id,
      status: 'in_progress',
      arrivalNotifiedAt: null,
      locationLatitude: { $ne: null },
      locationLongitude: { $ne: null },
    },
    { id: 1, ticketCode: 1, userId: 1, locationLatitude: 1, locationLongitude: 1 },
  ).lean();
  for (const ticket of activeTickets) {
    const distance = distanceMeters(location, {
      latitude: ticket.locationLatitude,
      longitude: ticket.locationLongitude,
    });
    if (distance === null || distance > WORKER_NEARBY_DISTANCE_METERS) continue;
    const marked = await Ticket.updateOne(
      { id: ticket.id, status: 'in_progress', arrivalNotifiedAt: null },
      { $set: { arrivalNotifiedAt: now } },
    );
    if (marked.modifiedCount === 1) {
      await createNotification({
        userId: ticket.userId,
        title: 'Worker Is Nearby',
        message: `${ticket.ticketCode}: ${req.user.firstName} ${req.user.lastName} is about ${Math.max(0, distance)} metres from the collection point.`,
      });
    }
  }

  return res.json({
    available: true,
    latitude: record.latitude,
    longitude: record.longitude,
    accuracy: record.accuracy,
    heading: record.heading ?? null,
    speed: record.speed ?? null,
    updatedAt: record.updatedAt,
  });
});

async function getRouteDetails(origin, destination, ticketId) {
  const cacheKey = `route:${ticketId}`;
  const cached = fastCache.get(cacheKey);
  if (cached) return cached;

  const straightDistance = distanceMeters(origin, destination);
  if (straightDistance === null) return null;

  try {
    const url = new URL(
      `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`
    );
    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'geojson');

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SmartWastePortal/1.0 (https://smartwasteportal.onrender.com)',
      },
      signal: AbortSignal.timeout(3500),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.routes) && data.routes.length > 0) {
        const primary = data.routes[0];
        const coordinates = primary.geometry?.coordinates ?? [];
        // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
        const polyline = coordinates.map(([lng, lat]) => [Number(lat), Number(lng)]);
        const roadDistance = Math.round(Number(primary.distance));
        const durationSeconds = Math.round(Number(primary.duration));
        const etaMinutes = Math.max(1, Math.round(durationSeconds / 60));

        const result = {
          distanceMeters: roadDistance,
          durationSeconds,
          etaMinutes,
          polyline,
          source: 'osrm',
        };
        fastCache.set(cacheKey, result, 30_000);
        return result;
      }
    }
  } catch {
    // Fall back smoothly to geodesic interpolation
  }

  // Fallback: estimate urban collection speed at 20 km/h (5.55 m/s)
  const durationSeconds = Math.round(straightDistance / 5.55);
  const etaMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const fallback = {
    distanceMeters: straightDistance,
    durationSeconds,
    etaMinutes,
    polyline: [
      [origin.latitude, origin.longitude],
      [destination.latitude, destination.longitude],
    ],
    source: 'fallback',
  };
  fastCache.set(cacheKey, fallback, 15_000);
  return fallback;
}

app.get('/api/tickets/:id/worker-location', authMiddleware, async (req, res) => {
  const id = parseNumericId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ticket id.' });
  const ticket = await Ticket.findOne({ id }).lean();
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ message: 'No permission to view worker location.' });
  }
  const [ticketRecord] = await buildTicketRecords([ticket], req.user);
  const unavailable = {
    available: false,
    distanceMeters: null,
    etaMinutes: null,
    durationSeconds: null,
    heading: null,
    nearby: false,
    ticket: ticketRecord,
    polyline: [],
  };
  if (!ticket.workerId || !['accepted', 'in_progress'].includes(ticket.status)) {
    return res.json(unavailable);
  }
  const location = await WorkerLocation.findOne({ workerId: ticket.workerId }).lean();
  if (!location || !isFreshWorkerLocation(location.updatedAt)) {
    return res.json(unavailable);
  }
  const destination = normalizeCoordinates({
    latitude: ticket.locationLatitude,
    longitude: ticket.locationLongitude,
  });

  const route = destination ? await getRouteDetails(location, destination, ticket.id) : null;
  const distance = route?.distanceMeters ?? (destination ? distanceMeters(location, destination) : null);
  const etaMinutes = route?.etaMinutes ?? (distance ? Math.max(1, Math.round(distance / (20 * 1000 / 60))) : null);
  const durationSeconds = route?.durationSeconds ?? (etaMinutes ? etaMinutes * 60 : null);
  const polyline = route?.polyline ?? (destination ? [
    [location.latitude, location.longitude],
    [destination.latitude, destination.longitude],
  ] : []);
  const bearing = destination ? calculateBearing(location, destination) : 0;
  const heading = location.heading ?? bearing;

  return res.json({
    available: true,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    heading,
    speed: location.speed ?? null,
    updatedAt: location.updatedAt,
    distanceMeters: distance,
    etaMinutes,
    durationSeconds,
    nearby: distance !== null && distance <= WORKER_NEARBY_DISTANCE_METERS,
    ticket: ticketRecord,
    polyline,
  });
});

app.get('/api/locations/search', authMiddleware, addressSearchLimiter, async (req, res) => {
  const query = cleanBoundedText(req.query?.q, 120);
  if (!query || query.length < 3) {
    return res.status(400).json({ message: 'Enter at least 3 characters to search for an address.' });
  }

  const cacheKey = `addresses:${query.toLowerCase()}`;
  const cached = fastCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '5');
    url.searchParams.set('lang', 'en');
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'SmartWastePortal/1.0 (https://smartwasteportal.onrender.com)' },
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) throw new Error(`Photon returned ${response.status}`);
    const text = await response.text();
    if (text.length > 1_000_000) throw new Error('Photon response too large');
    const payload = {
      suggestions: photonSuggestions(JSON.parse(text)),
      attribution: '© OpenStreetMap contributors',
    };
    fastCache.set(cacheKey, payload, 5 * 60 * 1000);
    return res.json(payload);
  } catch {
    return res.status(503).json({ message: 'Address suggestions are temporarily unavailable. You can still enter the address manually.' });
  }
});

}
