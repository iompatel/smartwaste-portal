export function registerLeaveRoutes(app, context) {
  const {
    LeaveApplication,
    User,
    WorkerLocation,
    authMiddleware,
    requireRoles,
    cleanBoundedText,
    cleanRecord,
    createAccountActivity,
    createAdminActivity,
    createNotification,
    fastCache,
    nextId,
    parseNumericId,
    sanitizeUser,
  } = context;

  const VALID_LEAVE_TYPES = ['Personal', 'Sick Leave', 'Casual Leave', 'Emergency', 'Annual'];

  // Worker: Apply for leave
  app.post(
    '/api/worker/leaves',
    authMiddleware,
    requireRoles('worker'),
    async (req, res) => {
      const { startDate, endDate, leaveType = 'Personal', reason } = req.body ?? {};
      const cleanReason = cleanBoundedText(reason, 500);
      if (!cleanReason) {
        return res.status(400).json({ message: 'A reason for leave is required (max 500 characters).' });
      }

      if (!VALID_LEAVE_TYPES.includes(leaveType)) {
        return res.status(400).json({ message: `Leave type must be one of: ${VALID_LEAVE_TYPES.join(', ')}.` });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Valid start date and end date are required.' });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (end < todayStart) {
        return res.status(400).json({ message: 'End date cannot be in the past.' });
      }

      if (start > end) {
        return res.status(400).json({ message: 'Start date cannot be after end date.' });
      }

      const now = new Date();
      const id = await nextId('leaveApplications');
      const leave = await LeaveApplication.create({
        id,
        workerId: req.user.id,
        startDate: start,
        endDate: end,
        leaveType,
        reason: cleanReason,
        status: 'pending',
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: now,
      });

      const workerName = `${req.user.firstName ?? ''} ${req.user.lastName ?? ''}`.trim() || `Worker #${req.user.id}`;
      const admins = await User.find({ role: 'admin' }, { id: 1 }).lean();
      await Promise.all(
        admins.map((admin) =>
          createNotification({
            userId: admin.id,
            title: 'New Leave Application',
            message: `${workerName} (Worker #${req.user.id}) applied for ${leaveType} from ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}.`,
          }),
        ),
      );

      await createAccountActivity({
        actor: req.user,
        action: 'Applied for Leave',
        targetType: 'leave',
        targetId: leave.id,
        summary: `Applied for ${leaveType} (${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}).`,
      });

      return res.status(201).json(cleanRecord(leave));
    },
  );

  // Worker: View personal leave history
  app.get(
    '/api/worker/leaves',
    authMiddleware,
    requireRoles('worker'),
    async (req, res) => {
      const leaves = await LeaveApplication.find({ workerId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      return res.json(leaves.map((leave) => cleanRecord(leave)));
    },
  );

  // Admin: View all leave applications (with optional status filter)
  app.get(
    '/api/admin/leaves',
    authMiddleware,
    requireRoles('admin'),
    async (req, res) => {
      const filter = {};
      const status = String(req.query.status ?? '').trim().toLowerCase();
      if (['pending', 'approved', 'rejected'].includes(status)) {
        filter.status = status;
      }

      const leaves = await LeaveApplication.find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      const workerIds = [
        ...new Set(
          leaves
            .map((leave) => Number(leave.workerId))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ];

      const workers = workerIds.length
        ? await User.find({ id: { $in: workerIds }, role: 'worker' }, { passwordHash: 0 }).lean()
        : [];
      const workerMap = new Map(workers.map((worker) => [worker.id, sanitizeUser(worker)]));

      return res.json(
        leaves.map((leave) => ({
          ...cleanRecord(leave),
          worker: workerMap.get(leave.workerId) ?? null,
        })),
      );
    },
  );

  // Admin: Approve or Reject a leave application
  app.put(
    '/api/admin/leaves/:id/status',
    authMiddleware,
    requireRoles('admin'),
    async (req, res) => {
      const id = parseNumericId(req.params.id);
      if (!id) return res.status(400).json({ message: 'Invalid leave application ID.' });

      const status = String(req.body?.status ?? '').trim().toLowerCase();
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved' or 'rejected'." });
      }

      let rejectionReason = null;
      if (status === 'rejected') {
        rejectionReason = cleanBoundedText(req.body?.rejectionReason, 500);
        if (!rejectionReason) {
          return res.status(400).json({ message: 'A rejection reason is required to reject a leave request.' });
        }
      }

      const leave = await LeaveApplication.findOne({ id });
      if (!leave) {
        return res.status(404).json({ message: 'Leave application not found.' });
      }

      const now = new Date();
      leave.status = status;
      leave.rejectionReason = rejectionReason;
      leave.reviewedBy = req.user.id;
      leave.reviewedAt = now;
      await leave.save();

      const startDateStr = new Date(leave.startDate).toISOString().slice(0, 10);
      const endDateStr = new Date(leave.endDate).toISOString().slice(0, 10);

      if (status === 'approved') {
        await createNotification({
          userId: leave.workerId,
          title: 'Leave Approved',
          message: `Your leave request from ${startDateStr} to ${endDateStr} has been approved.`,
        });

        // If leave spans today, ensure the worker is off-duty
        if (leave.startDate <= now && leave.endDate >= now) {
          await User.updateOne(
            { id: leave.workerId },
            { workerOnline: false, workerLastSeenAt: null, updatedAt: now },
          );
          await WorkerLocation.deleteOne({ workerId: leave.workerId });
          fastCache.invalidate('workers:');
        }
      } else {
        await createNotification({
          userId: leave.workerId,
          title: 'Leave Application Rejected',
          message: `Your leave request from ${startDateStr} to ${endDateStr} was rejected. Reason: ${rejectionReason}`,
        });
      }

      await createAdminActivity({
        adminUser: req.user,
        sessionLabel: req.sessionLabel,
        action: `Leave ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        targetType: 'leave',
        targetId: leave.id,
        summary: `${status === 'approved' ? 'Approved' : 'Rejected'} leave application #${leave.id} for Worker #${leave.workerId}.`,
      });

      return res.json(cleanRecord(leave));
    },
  );

  // Admin: View all workers currently on approved active leave today
  app.get(
    '/api/admin/workers/on-leave',
    authMiddleware,
    requireRoles('admin'),
    async (_req, res) => {
      const now = new Date();
      const leaves = await LeaveApplication.find({
        status: 'approved',
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
        .sort({ endDate: 1 })
        .lean();

      const workerIds = [
        ...new Set(
          leaves
            .map((leave) => Number(leave.workerId))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ];

      const workers = workerIds.length
        ? await User.find({ id: { $in: workerIds }, role: 'worker' }, { passwordHash: 0 }).lean()
        : [];
      const workerMap = new Map(workers.map((worker) => [worker.id, sanitizeUser(worker)]));

      return res.json(
        leaves.map((leave) => {
          const endDate = new Date(leave.endDate);
          const msLeft = Math.max(0, endDate.getTime() - now.getTime());
          const daysRemaining = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
          return {
            ...cleanRecord(leave),
            worker: workerMap.get(leave.workerId) ?? null,
            daysRemaining,
          };
        }),
      );
    },
  );
}
