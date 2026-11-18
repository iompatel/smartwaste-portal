export function registerNotificationRoutes(app, ctx) {
  const {
    AdminActivity,
    Notification,
    User,
    authMiddleware,
    cleanBoundedText,
    cleanRecord,
    createAdminActivity,
    createNotification,
    isNotificationTargetRole,
    parseNumericId,
    requireRoles,
  } = ctx;

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
}
