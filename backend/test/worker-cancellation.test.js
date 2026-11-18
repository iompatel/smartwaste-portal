import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-length-12345';
process.env.ADMIN_SESSION_SECRET = 'test-admin-secret-with-sufficient-length-12345';

const { app } = await import('../src/server.js');
const { AccountActivity } = await import('../src/activity.js');
const Ticket = mongoose.model('Ticket');
const User = mongoose.model('User');
const Notification = mongoose.model('Notification');
const HireRequest = mongoose.model('HireRequest');
const LeaveApplication = mongoose.model('LeaveApplication');
const AdminActivity = mongoose.model('AdminActivity');
const Review = mongoose.model('Review');
const Counter = mongoose.model('Counter');

const worker = { id: 7, role: 'worker', firstName: 'Field', lastName: 'Worker', email: 'worker@example.test' };
const otherWorker = { id: 8, role: 'worker', firstName: 'Other', lastName: 'Worker', email: 'other@example.test' };
const citizen = { id: 2, role: 'user', firstName: 'Citizen', lastName: 'One', email: 'citizen@example.test' };

async function call(method, path, req = {}) {
  const route = app.router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; return this; } };
  await route.stack.at(-1).handle({ body: {}, params: {}, query: {}, user: worker, ...req }, res);
  return res;
}

test('worker can cancel ticket if a query or blocking issue occurs', async (t) => {
  let counter = 10;
  t.mock.method(Counter, 'findOneAndUpdate', async () => ({ value: ++counter }));
  t.mock.method(AccountActivity, 'create', async (event) => event);
  t.mock.method(AdminActivity, 'create', async (event) => event);
  t.mock.method(LeaveApplication, 'find', () => ({ lean: async () => [] }));
  t.mock.method(Review, 'find', () => ({ lean: async () => [] }));

  const ticket = {
    id: 101,
    ticketCode: 'SWM-000101',
    userId: 2,
    workerId: 7,
    status: 'assigned',
    updatedAt: new Date(),
    wasteType: 'Mixed waste',
    description: 'Pile near main gate',
    locationAddress: '221B Baker St',
  };

  t.mock.method(Ticket, 'findOne', async () => ticket);
  t.mock.method(HireRequest, 'exists', async () => false);
  t.mock.method(HireRequest, 'find', () => ({ lean: async () => [] }));

  // Cancellation without reason fails
  const noReasonRes = await call('put', '/api/tickets/:id/status', {
    user: worker,
    params: { id: '101' },
    body: { status: 'cancelled', reason: '' },
  });
  assert.equal(noReasonRes.statusCode, 400);

  // Worker not assigned cannot cancel
  const wrongWorkerRes = await call('put', '/api/tickets/:id/status', {
    user: otherWorker,
    params: { id: '101' },
    body: { status: 'cancelled', reason: 'Road blocked' },
  });
  assert.equal(wrongWorkerRes.statusCode, 403);

  // Cancellation with query reason succeeds
  let updateData = null;
  const updatedDoc = {
    ...ticket,
    status: 'cancelled',
    cancelledBy: 7,
    cancellationReason: 'Road blocked by construction equipment; location inaccessible.',
    statusHistory: [{ status: 'cancelled', actorId: 7, note: 'Cancelled by operative: Road blocked' }],
    updatedAt: new Date(),
    createdAt: new Date(),
  };

  t.mock.method(Ticket, 'findOneAndUpdate', async (_filter, update) => {
    updateData = update;
    return updatedDoc;
  });
  t.mock.method(Ticket, 'find', () => ({
    sort() { return this; },
    limit() { return Promise.resolve([]); },
  }));
  t.mock.method(User, 'find', () => ({
    lean: async () => [{ id: 1, role: 'admin' }, citizen, worker],
  }));
  const notifications = [];
  t.mock.method(Notification, 'create', async (n) => { notifications.push(n); return n; });

  const cancelRes = await call('put', '/api/tickets/:id/status', {
    user: worker,
    params: { id: '101' },
    body: { status: 'cancelled', reason: 'Road blocked by construction equipment; location inaccessible.' },
  });

  assert.equal(cancelRes.statusCode, 200);
  assert.equal(updateData.$set.status, 'cancelled');
  assert.equal(updateData.$set.cancellationReason, 'Road blocked by construction equipment; location inaccessible.');
  assert.equal(updateData.$set.cancelledBy, 7);

  // Citizen and admin notifications were dispatched
  const citizenNotif = notifications.find((n) => n.userId === 2);
  assert.ok(citizenNotif);
  assert.match(citizenNotif.title, /Cancelled/);
  assert.match(citizenNotif.message, /Road blocked by construction/);

  const adminNotif = notifications.find((n) => n.userId === 1);
  assert.ok(adminNotif);
  assert.match(adminNotif.title, /Operative Cancelled Ticket/);
});
