import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-length-12345';
process.env.ADMIN_SESSION_SECRET = 'test-admin-secret-with-sufficient-length-12345';

const { app } = await import('../src/server.js');
const { AccountActivity, activityQuery, ticketActivitySnapshot, accountActivitySnapshot } = await import('../src/activity.js');
const { hashAdminSecret } = await import('../src/admin-session.js');
const models = Object.fromEntries(['User', 'Ticket', 'Review', 'Counter', 'Notification', 'AdminActivity',
  'AdminSession', 'DeletedIdentity', 'HireRequest', 'WorkerLocation', 'LeaveApplication'].map((name) => [name, mongoose.model(name)]));
const admin = { id: 1, role: 'admin', firstName: 'Portal', lastName: 'Admin', email: 'admin@example.test' };
const worker = { id: 7, role: 'worker', firstName: 'Field', lastName: 'Worker', email: 'worker@example.test',
  gender: 'Other', mobile: '9999999999', address: '1 Main Street', workerOnline: false, tokenVersion: 4 };

async function call(method, path, req = {}) {
  const route = app.router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; return this; } };
  await route.stack.at(-1).handle({ body: {}, params: {}, query: {}, user: admin, ...req }, res);
  return res;
}

function activityMocks(t) {
  const events = [];
  let counter = 0;
  t.mock.method(models.Counter, 'findOneAndUpdate', async () => ({ value: ++counter }));
  t.mock.method(AccountActivity, 'create', async (event) => { events.push(event); return event; });
  t.mock.method(models.AdminActivity, 'create', async (event) => event);
  t.mock.method(models.LeaveApplication, 'find', () => ({ lean: async () => [] }));
  t.mock.method(models.LeaveApplication, 'exists', async () => false);
  return events;
}

function matchesAccountGuard(filter, account) {
  if (filter.id !== account.id) return false;
  if (filter.updatedAt?.$exists === false ? account.updatedAt !== undefined
    : new Date(filter.updatedAt).getTime() !== new Date(account.updatedAt).getTime()) return false;
  if (filter.tokenVersion !== undefined && filter.tokenVersion !== account.tokenVersion) return false;
  return !filter.$or || account.tokenVersion === 0 || account.tokenVersion === undefined;
}

function applyAccountUpdate(account, update) {
  const result = { ...account, ...update.$set };
  if (update.$inc?.tokenVersion) result.tokenVersion = Number(account.tokenVersion ?? 0) + update.$inc.tokenVersion;
  for (const key of Object.keys(update.$unset ?? {})) delete result[key];
  return result;
}

test('activity filters include the entire selected day and validate pagination', () => {
  const { filter, page, limit } = activityQuery({ role: 'worker', actorId: '7', action: 'Ticket Completed',
    from: '2026-01-01', to: '2026-01-31', page: '2', limit: '500' });
  assert.equal(filter.actorRole, 'worker');
  assert.equal(filter.actorId, 7);
  assert.equal(filter.createdAt.$lte.toISOString(), '2026-01-31T23:59:59.999Z');
  assert.equal(filter.createdAt.$gte.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(page, 2);
  assert.equal(limit, 100);
  for (const query of [{ role: 'system' }, { actorId: 'abc' }, { page: '0' }, { from: '2026-02-31' },
    { from: '2026-02-01', to: '2026-01-31' }]) assert.throws(() => activityQuery(query));
});

test('activity snapshots retain report details without credentials, OTPs or duplicated images', () => {
  const ticket = ticketActivitySnapshot({ id: 8, ticketCode: 'SWM-000008', userId: 9, workerId: 7,
    completionCode: '123456', completionCodeHash: 'secret', mediaData: 'data:image/png;base64,YQ==',
    completionMediaData: 'https://firebasestorage.googleapis.com/v0/b/demo/o/completion.jpg?alt=media',
    statusHistory: [{ status: 'completed', actorId: 7, actorRole: 'worker', createdAt: new Date() }] });
  const account = accountActivitySnapshot({ ...worker, password: 'Password!123', passwordHash: 'hashed',
    tokenVersion: 4, firebaseUid: 'private-uid' });
  const serialized = JSON.stringify({ ticket, account });
  for (const secret of ['123456', 'completionCode', 'Password!123', 'passwordHash', 'tokenVersion', 'private-uid', 'base64']) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.equal(ticket.hasBeforeImage, true);
  assert.equal(ticket.beforeImageUrl, null);
  assert.ok(ticket.afterImageUrl);
  assert.equal(ticket.statusHistory[0].status, 'completed');
});

test('admin creation validates confirmation and reserves unique explicit worker IDs', async (t) => {
  const events = activityMocks(t);
  const reservations = [];
  t.mock.method(models.Counter, 'findOneAndUpdate', async (filter, update) => {
    reservations.push({ filter, update }); return { value: 100 };
  });
  t.mock.method(models.User, 'findOne', () => ({ lean: async () => null }));
  t.mock.method(models.User, 'exists', async () => false);
  t.mock.method(models.User, 'create', async (value) => value);
  t.mock.method(models.DeletedIdentity, 'deleteOne', async () => ({}));
  const body = { ...worker, id: 88, password: 'Password!123' };
  assert.equal((await call('post', '/api/users', { body })).statusCode, 400);
  assert.equal((await call('post', '/api/users', { body: { ...body, confirmPassword: 'Different!123' } })).statusCode, 400);
  const res = await call('post', '/api/users', { body: { ...body, confirmPassword: body.password } });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.id, 88);
  assert.equal(res.body.passwordHash, undefined);
  assert.ok(reservations.some((item) => item.filter.key === 'users' && item.update.$max?.value === 88));
  assert.equal(events[0].action, 'Account Created');
  assert.equal(events[0].details.id, 88);
  assert.equal(JSON.stringify(events).includes(body.password), false);
  t.mock.method(models.User, 'exists', async () => true);
  assert.equal((await call('post', '/api/users', { body: { ...body, confirmPassword: body.password } })).statusCode, 409);
});

test('password changes hash the new password and revoke bearer versions and admin sessions', async (t) => {
  const events = activityMocks(t);
  const existing = { ...worker, passwordHash: await bcrypt.hash('OldPassword!123', 4), save: async () => {} };
  t.mock.method(models.User, 'findOne', (filter) => filter.email ? { lean: async () => null } : Promise.resolve(existing));
  t.mock.method(models.User, 'findOneAndUpdate', async (filter, update) => {
    assert.ok(matchesAccountGuard(filter, existing));
    assert.deepEqual(update.$inc, { tokenVersion: 1 });
    Object.assign(existing, applyAccountUpdate(existing, update));
    return existing;
  });
  const revoked = [];
  t.mock.method(models.AdminSession, 'deleteMany', async (filter) => { revoked.push(filter); return {}; });
  const invalid = await call('put', '/api/users/:id', { params: { id: '7' }, body: { password: 'NewPassword!123' } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(existing.tokenVersion, 4);
  const res = await call('put', '/api/users/:id', { params: { id: '7' },
    body: { password: 'NewPassword!123', confirmPassword: 'NewPassword!123' } });
  assert.equal(res.statusCode, 200);
  assert.equal(existing.tokenVersion, 5);
  assert.ok(await bcrypt.compare('NewPassword!123', existing.passwordHash));
  assert.deepEqual(revoked, [{ userId: 7 }]);
  assert.equal(JSON.stringify(events).includes('NewPassword!123'), false);
});

test('concurrent password resets reject stale writes and each successful reset revokes the previous version', async (t) => {
  activityMocks(t);
  let stored = { ...worker, passwordHash: 'old-hash', updatedAt: new Date() };
  t.mock.method(models.User, 'findOne', (filter) => filter.email ? { lean: async () => null } : Promise.resolve({ ...stored }));
  t.mock.method(models.User, 'findOneAndUpdate', async (filter, update) => {
    if (!matchesAccountGuard(filter, stored)) return null;
    stored = applyAccountUpdate(stored, update);
    return { ...stored };
  });
  t.mock.method(models.AdminSession, 'deleteMany', async () => ({}));
  const reset = (password) => call('put', '/api/users/:id', { params: { id: '7' }, body: { password, confirmPassword: password } });
  const responses = await Promise.all([reset('FirstPassword!123'), reset('SecondPassword!123')]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409]);
  const versionBetweenResets = stored.tokenVersion;
  assert.equal(versionBetweenResets, 5);
  assert.equal((await reset('RetryPassword!123')).statusCode, 200);
  assert.equal(stored.tokenVersion, 6);
  assert.notEqual(stored.tokenVersion, versionBetweenResets);
});

test('profile edits cannot overwrite an account after concurrent credential changes', async (t) => {
  activityMocks(t);
  const stale = { ...worker, passwordHash: 'old-hash', updatedAt: new Date() };
  const stored = { ...stale, tokenVersion: 5, passwordHash: 'newer-hash', updatedAt: new Date(stale.updatedAt.getTime() + 1) };
  t.mock.method(models.User, 'findOne', (filter) => filter.email ? { lean: async () => null } : Promise.resolve(stale));
  t.mock.method(models.User, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(update.$set.passwordHash, undefined);
    assert.equal(update.$inc, undefined);
    assert.equal(matchesAccountGuard(filter, stored), false);
    return null;
  });
  const res = await call('put', '/api/users/:id', { params: { id: '7' }, body: { address: 'Updated address' } });
  assert.equal(res.statusCode, 409);
  assert.equal(stored.passwordHash, 'newer-hash');
  assert.equal(stored.tokenVersion, 5);
});

test('legacy accounts without stored timestamps or token versions can be updated safely', async (t) => {
  activityMocks(t);
  let stored = { ...worker, passwordHash: 'old-hash' };
  delete stored.tokenVersion;
  const legacy = models.User.hydrate(stored);
  t.mock.method(models.User, 'findOne', (filter) => filter.email ? { lean: async () => null } : Promise.resolve(legacy));
  t.mock.method(models.User, 'findOneAndUpdate', async (filter, update) => {
    assert.deepEqual(filter.updatedAt, { $exists: false });
    assert.ok(matchesAccountGuard(filter, stored));
    stored = applyAccountUpdate(stored, update);
    return { ...stored };
  });
  t.mock.method(models.AdminSession, 'deleteMany', async () => ({}));
  const res = await call('put', '/api/users/:id', { params: { id: '7' },
    body: { password: 'NewPassword!123', confirmPassword: 'NewPassword!123' } });
  assert.equal(res.statusCode, 200);
  assert.equal(stored.tokenVersion, 1);
  assert.ok(stored.updatedAt instanceof Date);
});

test('failed credential side effects restore their own write and revoke intermediate tokens', async (t) => {
  activityMocks(t);
  const original = { ...worker, passwordHash: 'old-hash', updatedAt: new Date() };
  let stored = { ...original };
  t.mock.method(models.User, 'findOne', (filter) => filter.email ? { lean: async () => null } : Promise.resolve({ ...stored }));
  t.mock.method(models.User, 'findOneAndUpdate', async (filter, update) => {
    assert.ok(matchesAccountGuard(filter, stored));
    stored = applyAccountUpdate(stored, update);
    return { ...stored };
  });
  t.mock.method(models.AdminSession, 'deleteMany', async () => { throw new Error('Session store unavailable'); });
  await assert.rejects(() => call('put', '/api/users/:id', { params: { id: '7' },
    body: { password: 'NewPassword!123', confirmPassword: 'NewPassword!123', address: 'Staged address' } }), /Session store unavailable/);
  assert.equal(stored.passwordHash, original.passwordHash);
  assert.equal(stored.address, original.address);
  assert.equal(stored.tokenVersion, 6);
});

test('rollback cannot overwrite a later successful edit or downgrade its token version', async (t) => {
  activityMocks(t);
  let stored = { ...worker, passwordHash: 'old-hash', updatedAt: new Date() };
  t.mock.method(models.User, 'findOne', (filter) => filter.email ? { lean: async () => null } : Promise.resolve({ ...stored }));
  t.mock.method(models.User, 'findOneAndUpdate', async (filter, update) => {
    if (!matchesAccountGuard(filter, stored)) return null;
    stored = applyAccountUpdate(stored, update);
    return { ...stored };
  });
  t.mock.method(models.AdminSession, 'deleteMany', async () => {
    stored = { ...stored, passwordHash: 'later-password-hash', address: 'Later address', tokenVersion: 6,
      updatedAt: new Date(stored.updatedAt.getTime() + 1) };
    throw new Error('Downstream credential operation failed');
  });
  const res = await call('put', '/api/users/:id', { params: { id: '7' },
    body: { password: 'NewPassword!123', confirmPassword: 'NewPassword!123', address: 'Staged address' } });
  assert.equal(res.statusCode, 409);
  assert.equal(stored.passwordHash, 'later-password-hash');
  assert.equal(stored.address, 'Later address');
  assert.equal(stored.tokenVersion, 6);
});

test('worker availability logs each transition once and no heartbeat activity', async (t) => {
  const events = activityMocks(t);
  let state = { ...worker };
  t.mock.method(models.User, 'findOneAndUpdate', async (_filter, update) => {
    const previous = { ...state }; Object.assign(state, update.$set); return previous;
  });
  t.mock.method(models.User, 'find', () => ({ lean: async () => [] }));
  t.mock.method(models.HireRequest, 'find', () => ({ lean: async () => [] }));
  t.mock.method(models.WorkerLocation, 'deleteOne', async () => ({}));
  t.mock.method(models.User, 'updateOne', async () => ({ matchedCount: 1 }));
  for (const online of [true, true, false, false]) {
    await call('put', '/api/workers/me/availability', { user: worker, body: { online } });
  }
  await call('post', '/api/workers/me/heartbeat', { user: worker });
  assert.deepEqual(events.map((event) => event.action), ['Worker Online', 'Worker Offline']);
});

test('account reports refuse registers above the 500-account PDF limit', async (t) => {
  t.mock.method(models.User, 'find', () => ({
    sort() { return this; },
    limit(value) { assert.equal(value, 501); return this; },
    lean: async () => Array.from({ length: 501 }, (_, index) => ({ ...worker, id: index + 1 })),
  }));
  const res = await call('get', '/api/admin/reports/:role', { params: { role: 'workers' }, query: {} });
  assert.equal(res.statusCode, 413);
  assert.match(res.body.message, /at most 500 accounts/);
});

test('GPS expiry follows the captured fix rather than the upload time', async (t) => {
  t.mock.method(models.User, 'findOne', () => ({ lean: async () => ({ id: worker.id }) }));
  t.mock.method(models.User, 'updateOne', async () => ({ matchedCount: 1 }));
  t.mock.method(models.Ticket, 'find', () => ({ lean: async () => [] }));
  let stored;
  t.mock.method(models.WorkerLocation, 'findOneAndUpdate', async (_filter, update) => {
    stored = update.$set; return stored;
  });
  const sampledAt = new Date(Date.now() - 30000).toISOString();
  const body = { latitude: 23.02, longitude: 72.57, accuracy: 8, sampledAt };
  const response = await call('put', '/api/workers/me/location', { user: worker, body });
  assert.equal(response.statusCode, 200);
  assert.equal(stored.updatedAt.toISOString(), sampledAt);
  assert.equal(stored.expiresAt.getTime(), new Date(sampledAt).getTime() + 120000);
  for (const timestamp of ['invalid', new Date(Date.now() - 121000).toISOString(), new Date(Date.now() + 30000).toISOString()]) {
    const result = await call('put', '/api/workers/me/location', { user: worker, body: { ...body, sampledAt: timestamp } });
    assert.equal(result.statusCode, 400);
  }
});

test('worker GPS creates one nearby notification for a geocoded active ticket', async (t) => {
  const notifications = [];
  t.mock.method(models.User, 'findOne', () => ({ lean: async () => ({ id: worker.id }) }));
  t.mock.method(models.User, 'updateOne', async () => ({ matchedCount: 1 }));
  t.mock.method(models.WorkerLocation, 'findOneAndUpdate', async (_filter, update) => update.$set);
  t.mock.method(models.Ticket, 'find', () => ({ lean: async () => [{
    id: 20,
    ticketCode: 'SWM-000020',
    userId: 9,
    locationLatitude: 23.0225,
    locationLongitude: 72.5714,
  }] }));
  t.mock.method(models.Ticket, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(models.Counter, 'findOneAndUpdate', async () => ({ value: 1 }));
  t.mock.method(models.Notification, 'create', async (notification) => { notifications.push(notification); return notification; });

  const response = await call('put', '/api/workers/me/location', {
    user: { ...worker, firstName: 'Field', lastName: 'Worker' },
    body: { latitude: 23.0226, longitude: 72.5714, accuracy: 5, sampledAt: new Date().toISOString() },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].userId, 9);
  assert.match(notifications[0].title, /Nearby/);
});

test('ticket tracking exposes worker contact only to the authorized requester', async (t) => {
  const now = new Date();
  const citizen = { ...worker, id: 9, role: 'user', firstName: 'Resident', mobile: '8888888888' };
  const ticket = { id: 20, ticketCode: 'SWM-000020', userId: 9, workerId: 7, status: 'in_progress',
    wasteType: 'Plastic', description: 'Collect plastic', locationAddress: 'Street', priority: 'medium',
    locationLatitude: 23.0225, locationLongitude: 72.5714, updatedAt: now, createdAt: now, statusHistory: [] };
  t.mock.method(models.Ticket, 'findOne', () => ({ lean: async () => ticket }));
  t.mock.method(models.User, 'find', () => ({ lean: async () => [citizen, worker] }));
  t.mock.method(models.Review, 'find', () => ({ lean: async () => [] }));
  t.mock.method(models.WorkerLocation, 'findOne', () => ({ lean: async () => ({
    workerId: 7, latitude: 23.0226, longitude: 72.5714, accuracy: 5, updatedAt: now,
  }) }));

  const response = await call('get', '/api/tickets/:id/worker-location', {
    user: citizen,
    params: { id: '20' },
  });
  assert.equal(response.body.available, true);
  assert.equal(response.body.ticket.assignedWorker.id, 7);
  assert.equal(response.body.ticket.assignedWorker.mobile, worker.mobile);
  assert.ok(response.body.distanceMeters < 500);
});

test('worker logout logs offline only when the worker was online', async (t) => {
  const events = activityMocks(t);
  t.mock.method(models.User, 'findOneAndUpdate', async () => ({ ...worker, workerOnline: true }));
  t.mock.method(models.WorkerLocation, 'deleteOne', async () => ({}));
  await call('post', '/api/auth/logout', { user: worker });
  assert.deepEqual(events.map((event) => event.action), ['Worker Logout', 'Worker Offline']);
});

test('admin activity endpoint applies filters and returns count with stable pagination', async (t) => {
  const operations = [];
  t.mock.method(AccountActivity, 'find', (filter) => {
    operations.push({ filter });
    const query = { sort(value) { operations.push({ sort: value }); return this; },
      skip(value) { operations.push({ skip: value }); return this; },
      limit(value) { operations.push({ limit: value }); return this; },
      lean: async () => [{ _id: 'mongo-id', id: 9, action: 'Worker Login' }] };
    return query;
  });
  t.mock.method(AccountActivity, 'countDocuments', async () => 51);
  const res = await call('get', '/api/activity', { query: { role: 'worker', page: '3', limit: '20' } });
  assert.equal(res.body.total, 51);
  assert.equal(res.body.items[0]._id, undefined);
  assert.equal(operations[0].filter.actorRole, 'worker');
  assert.deepEqual(operations.find((operation) => operation.skip !== undefined), { skip: 40 });
  for (const path of ['/api/activity', '/api/admin/worker-locations', '/api/admin/reports/:role']) {
    const route = app.router.stack.find((layer) => layer.route?.path === path).route;
    const forbidden = { status(value) { this.statusCode = value; return this; }, json() { return this; } };
    let allowed = false;
    route.stack[1].handle({ user: worker }, forbidden, () => { allowed = true; });
    assert.equal(forbidden.statusCode, 403);
    assert.equal(allowed, false);
  }
});

test('admin GPS reads bulk data and hides missing, stale and offline positions', async (t) => {
  const now = new Date();
  const workers = [7, 8, 9, 10].map((id) => ({ ...worker, id, workerOnline: id !== 9, workerLastSeenAt: now }));
  t.mock.method(models.User, 'find', () => ({ sort() { return this; }, lean: async () => workers }));
  let gpsReads = 0;
  t.mock.method(models.WorkerLocation, 'find', (filter) => {
    gpsReads += 1; assert.ok(filter.expiresAt.$gt instanceof Date);
    return { lean: async () => [7, 9, 10].map((id) => ({ workerId: id, latitude: 20, longitude: 72, accuracy: 5,
      updatedAt: id === 10 ? new Date(now.getTime() - 180_000) : now })) };
  });
  t.mock.method(models.Ticket, 'find', () => ({ lean: async () => [{ id: 20, ticketCode: 'SWM-000020',
    workerId: 7, status: 'accepted', locationAddress: 'Street' }] }));
  const res = await call('get', '/api/admin/worker-locations');
  assert.equal(gpsReads, 1);
  assert.ok(res.body.workers[0].location);
  for (const row of res.body.workers.slice(1)) assert.equal(row.location, null);
  assert.equal(res.body.workers[0].activeTickets[0].id, 20);
});

test('citizen ticket creation persists a requester snapshot and original ticket details', async (t) => {
  const events = activityMocks(t);
  const citizen = { ...worker, id: 9, role: 'user', firstName: 'Resident', email: 'resident@example.test' };
  t.mock.method(models.Ticket, 'create', async (ticket) => ticket);
  t.mock.method(models.User, 'find', (filter) => ({ lean: async () => filter.id ? [citizen] : [] }));
  t.mock.method(models.Review, 'find', () => ({ lean: async () => [] }));
  t.mock.method(models.Notification, 'create', async (notification) => notification);
  const res = await call('post', '/api/tickets', { user: citizen,
    body: { wasteType: 'Plastic', description: 'Missed collection', locationAddress: '2 Main Street', priority: 'high' } });
  assert.equal(res.statusCode, 201);
  const event = events.find((entry) => entry.action === 'Ticket Created');
  assert.equal(event.actorRole, 'user');
  assert.equal(event.details.description, 'Missed collection');
  assert.equal(event.details.requester.email, citizen.email);
  assert.equal(event.details.statusHistory[0].status, 'pending');
});

test('worker completion persists proof, participant details and history without the OTP', async (t) => {
  const events = activityMocks(t);
  const now = new Date();
  const citizen = { ...worker, id: 9, role: 'user', firstName: 'Resident', email: 'resident@example.test' };
  const ticket = { id: 20, ticketCode: 'SWM-000020', userId: 9, workerId: 7, status: 'in_progress',
    wasteType: 'Plastic', description: 'Collect plastic', locationAddress: 'Street', priority: 'medium',
    updatedAt: now, createdAt: now, completionCode: '123456', completionCodeHash: hashAdminSecret('123456'),
    statusHistory: [{ status: 'in_progress', actorId: 7, actorRole: 'worker', createdAt: now }] };
  t.mock.method(models.Ticket, 'findOne', async () => ticket);
  t.mock.method(models.Ticket, 'findOneAndUpdate', async (_filter, update) => ({
    ...ticket, ...update.$set, statusHistory: [...ticket.statusHistory, update.$push.statusHistory],
  }));
  t.mock.method(models.HireRequest, 'exists', async () => false);
  t.mock.method(models.HireRequest, 'find', () => ({ lean: async () => [] }));
  t.mock.method(models.User, 'find', (filter) => ({ lean: async () => filter.id ? [citizen, worker] : [] }));
  t.mock.method(models.Review, 'find', () => ({ lean: async () => [] }));
  t.mock.method(models.Notification, 'create', async (notification) => notification);
  const proof = 'https://firebasestorage.googleapis.com/v0/b/demo/o/completion%2Fphoto.jpg?alt=media';
  const res = await call('put', '/api/tickets/:id/status', { user: worker, params: { id: '20' },
    body: { status: 'completed', completionCode: '123456', completionMediaData: proof } });
  assert.equal(res.statusCode, 200);
  const event = events.find((entry) => entry.action === 'Ticket Completed');
  assert.equal(event.details.afterImageUrl, proof);
  assert.equal(event.details.worker.id, 7);
  assert.equal(event.details.requester.id, 9);
  assert.equal(event.details.statusHistory.at(-1).status, 'completed');
  assert.equal(JSON.stringify(event).includes('123456'), false);
  assert.equal(JSON.stringify(event).includes('completionCode'), false);
});

test('cancellation rejects a stale request after the worker accepts the ticket', async (t) => {
  const now = new Date();
  const ticket = { id: 20, ticketCode: 'SWM-000020', userId: 9, workerId: 7, status: 'assigned', updatedAt: now };
  t.mock.method(models.Ticket, 'findOne', async () => ticket);
  t.mock.method(models.Ticket, 'findOneAndUpdate', async (filter) => {
    assert.equal(filter.status, 'assigned'); assert.equal(filter.workerId, 7); assert.equal(filter.updatedAt, now);
    return null;
  });
  const res = await call('put', '/api/tickets/:id/cancel', { params: { id: '20' }, user: { id: 9, role: 'user' } });
  assert.equal(res.statusCode, 409);
  assert.equal(ticket.status, 'assigned');
});
