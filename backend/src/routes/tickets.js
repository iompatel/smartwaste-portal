export function registerTicketRoutes(app, ctx) {
  const {
    HireRequest,
    Notification,
    Review,
    TICKET_PRIORITIES,
    Ticket,
    TicketMessage,
    User,
    appendTicketStatus,
    authMiddleware,
    autoAssignUnassignedTickets,
    buildTicketDetailsMessage,
    buildTicketRecords,
    canAccessTicket,
    canWorkerTransition,
    cleanBoundedText,
    cleanRecord,
    createAccountActivity,
    createAdminActivity,
    createCompletionCode,
    createNotification,
    deleteMedia,
    fastCache,
    hashAdminSecret,
    isClosedTicket,
    isValidImageData,
    matchesAdminSecret,
    nextId,
    normalizeEmail,
    normalizeCoordinates,
    parseNumericId,
    pickFreeWorkerIdForTicket,
    publicWorkerProfile,
    requireRoles,
    sanitizeUser,
    ticketActivityDetails,
    ticketCreateLimiter,
    ticketMessageLimiter,
    truncateText,
    uploadMedia,
  } = ctx;

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
    locationLatitude = null,
    locationLongitude = null,
    priority = 'medium',
    mediaData = null,
  } = req.body ?? {};

  const cleanWasteType = cleanBoundedText(wasteType, 100);
  const cleanDescription = cleanBoundedText(description);
  const cleanLocation = cleanBoundedText(locationAddress, 500);
  if (!cleanWasteType || !cleanDescription || !cleanLocation) {
    return res.status(400).json({ message: 'Missing ticket fields.' });
  }
  const hasDestinationCoordinates = locationLatitude !== null || locationLongitude !== null;
  const destination = hasDestinationCoordinates
    ? normalizeCoordinates({ latitude: locationLatitude, longitude: locationLongitude })
    : null;
  if (hasDestinationCoordinates && !destination) {
    return res.status(400).json({ message: 'Report location coordinates are invalid.' });
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
      locationLatitude: destination?.latitude ?? null,
      locationLongitude: destination?.longitude ?? null,
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
  let assignedWorker = null;
  if (assignedWorkerId) {
    assignedWorker = await User.findOne(
      { id: assignedWorkerId, role: 'worker' },
      { id: 1, firstName: 1, lastName: 1, mobile: 1 },
    ).lean();
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
      ? `${ticket.ticketCode} created. Assigned to ${assignedWorker?.firstName ?? 'Worker'} ${assignedWorker?.lastName ?? `#${assignedWorkerId}`} (ID ${assignedWorkerId}${assignedWorker?.mobile ? `, ${assignedWorker.mobile}` : ''}).`
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
        message: `${ticket.ticketCode} was assigned to ${worker.firstName} ${worker.lastName} (ID ${worker.id}, ${worker.mobile}).`,
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
        message: `${ticket.ticketCode} was completed with OTP verification. The completion photo is ready to review.`,
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
  const coordinateInputChanged = req.body?.locationLatitude !== undefined || req.body?.locationLongitude !== undefined;
  const nextDestination = coordinateInputChanged
    ? normalizeCoordinates({
        latitude: req.body?.locationLatitude,
        longitude: req.body?.locationLongitude,
      })
    : normalizeCoordinates({ latitude: ticket.locationLatitude, longitude: ticket.locationLongitude });
  const nextMediaData = req.body?.mediaData ?? ticket.mediaData ?? null;
  if (!nextWasteType || !nextDescription || !nextLocation) {
    return res.status(400).json({ message: 'Ticket fields are invalid or too long.' });
  }
  if (coordinateInputChanged && !nextDestination) {
    return res.status(400).json({ message: 'Report location coordinates are invalid.' });
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
  ticket.locationLatitude = nextDestination?.latitude ?? null;
  ticket.locationLongitude = nextDestination?.longitude ?? null;
  if (coordinateInputChanged) ticket.arrivalNotifiedAt = null;
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

}
