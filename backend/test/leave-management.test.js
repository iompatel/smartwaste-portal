import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-length-12345';
process.env.ADMIN_SESSION_SECRET = 'test-admin-secret-with-sufficient-length-12345';

const { app } = await import('../src/server.js');
const { AccountActivity } = await import('../src/activity.js');
const LeaveApplication = mongoose.model('LeaveApplication');
const AdminActivity = mongoose.model('AdminActivity');
const User = mongoose.model('User');
const Notification = mongoose.model('Notification');
const Counter = mongoose.model('Counter');

const worker = { id: 7, role: 'worker', firstName: 'Field', lastName: 'Worker', email: 'worker@example.test' };
const admin = { id: 1, role: 'admin', firstName: 'Admin', lastName: 'User', email: 'admin@example.test' };

async function call(method, path, req = {}) {
  const route = app.router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; return this; } };
  await route.stack.at(-1).handle({ body: {}, params: {}, query: {}, user: worker, ...req }, res);
  return res;
}

test('worker leave application validates input and records application', async (t) => {
  let counter = 10;
  t.mock.method(Counter, 'findOneAndUpdate', async () => ({ value: ++counter }));
  t.mock.method(AccountActivity, 'create', async (event) => event);
  t.mock.method(AdminActivity, 'create', async (event) => event);

  // Missing reason fails
  const missingReason = await call('post', '/api/worker/leaves', {
    user: worker,
    body: { startDate: '2026-12-01', endDate: '2026-12-05', leaveType: 'Personal', reason: '' },
  });
  assert.equal(missingReason.statusCode, 400);

  // Invalid date range fails
  const invalidDates = await call('post', '/api/worker/leaves', {
    user: worker,
    body: { startDate: '2026-12-05', endDate: '2026-12-01', leaveType: 'Personal', reason: 'Family trip' },
  });
  assert.equal(invalidDates.statusCode, 400);

  // Valid application succeeds
  let createdDoc = null;
  t.mock.method(LeaveApplication, 'create', async (doc) => {
    createdDoc = doc;
    return doc;
  });
  t.mock.method(User, 'find', () => ({
    lean: async () => [{ id: admin.id }],
  }));
  t.mock.method(Notification, 'create', async (notif) => notif);

  const valid = await call('post', '/api/worker/leaves', {
    user: worker,
    body: { startDate: '2026-12-01', endDate: '2026-12-05', leaveType: 'Casual Leave', reason: 'Family function' },
  });
  assert.equal(valid.statusCode, 201);
  assert.equal(createdDoc.workerId, 7);
  assert.equal(createdDoc.status, 'pending');
  assert.equal(createdDoc.leaveType, 'Casual Leave');
  assert.equal(createdDoc.reason, 'Family function');
});

test('admin review approves or rejects with reason and notifies worker', async (t) => {
  let counter = 10;
  t.mock.method(Counter, 'findOneAndUpdate', async () => ({ value: ++counter }));
  t.mock.method(AccountActivity, 'create', async (event) => event);
  t.mock.method(AdminActivity, 'create', async (event) => event);

  const existingLeave = {
    id: 11,
    workerId: 7,
    startDate: new Date('2026-12-01'),
    endDate: new Date('2026-12-05'),
    leaveType: 'Personal',
    status: 'pending',
    rejectionReason: null,
    save: async function() { return this; },
  };

  t.mock.method(LeaveApplication, 'findOne', async () => existingLeave);
  const notifications = [];
  t.mock.method(Notification, 'create', async (n) => { notifications.push(n); return n; });

  // Rejection without reason fails
  const rejectNoReason = await call('put', '/api/admin/leaves/:id/status', {
    user: admin,
    params: { id: '11' },
    body: { status: 'rejected', rejectionReason: '' },
  });
  assert.equal(rejectNoReason.statusCode, 400);

  // Rejection with reason succeeds
  const rejectWithReason = await call('put', '/api/admin/leaves/:id/status', {
    user: admin,
    params: { id: '11' },
    body: { status: 'rejected', rejectionReason: 'Operational staff shortage on requested dates.' },
  });
  assert.equal(rejectWithReason.statusCode, 200);
  assert.equal(existingLeave.status, 'rejected');
  assert.equal(existingLeave.rejectionReason, 'Operational staff shortage on requested dates.');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].userId, 7);
  assert.match(notifications[0].message, /Operational staff shortage/);

  // Approval succeeds
  existingLeave.status = 'pending';
  const approve = await call('put', '/api/admin/leaves/:id/status', {
    user: admin,
    params: { id: '11' },
    body: { status: 'approved' },
  });
  assert.equal(approve.statusCode, 200);
  assert.equal(existingLeave.status, 'approved');
  assert.equal(notifications.length, 2);
  assert.equal(notifications[1].title, 'Leave Approved');
});

test('worker on approved leave cannot toggle availability online', async (t) => {
  t.mock.method(LeaveApplication, 'exists', async () => true);

  const res = await call('put', '/api/workers/me/availability', {
    user: worker,
    body: { online: true },
  });
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /cannot go on duty while on approved leave/);
});
