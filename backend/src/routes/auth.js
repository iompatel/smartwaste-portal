export function registerAuthRoutes(app, ctx) {
  const {
    AdminSession,
    DeletedIdentity,
    Notification,
    PENDING_REGISTRATION_TTL_MS,
    PendingRegistration,
    User,
    WorkerLocation,
    accountActivitySnapshot,
    authMiddleware,
    canUseLoginPortal,
    clearAdminCookie,
    createAccountActivity,
    createAdminActivity,
    createAdminSecret,
    createNotification,
    deleteMedia,
    deletedIdentityFilter,
    fastCache,
    firebaseIdentity,
    handleAdminLogin,
    handlePasswordLogin,
    hashPassword,
    isFirebaseEnabled,
    isValidProfileImage,
    nextId,
    normalizeAccountProfile,
    normalizeEmail,
    sendLoginResponse,
    uploadMedia,
    usesFirebasePasswordProvider,
    verifyFirebaseIdToken,
  } = ctx;

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

}
