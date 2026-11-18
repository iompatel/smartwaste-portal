import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { Socket } from 'node:net';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-length-12345';
process.env.ADMIN_SESSION_SECRET = 'test-admin-secret-with-sufficient-length-12345';

const { app } = await import('../src/server.js');
const User = mongoose.model('User');
const Counter = mongoose.model('Counter');
const AccountActivity = mongoose.model('AccountActivity');

function makeRequest(appInstance, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));

    const res = new http.ServerResponse(req);
    res.assignSocket(socket);

    let responseBody = '';
    res.write = function (chunk) {
      if (chunk) responseBody += chunk.toString();
      return true;
    };

    res.end = function (chunk) {
      if (chunk) responseBody += chunk.toString();
      let json = null;
      try {
        json = JSON.parse(responseBody);
      } catch {
        json = null;
      }
      resolve({ status: res.statusCode, headers: res.getHeaders(), body: json, text: responseBody });
    };

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.headers['content-length'] = String(Buffer.byteLength(payload));
      req.headers['content-type'] = 'application/json';
      appInstance(req, res);
      req.push(payload);
      req.push(null);
    } else {
      appInstance(req, res);
      req.push(null);
    }
  });
}

test('Worker account creation and login flow', async (t) => {
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);
  const workerData = {
    id: 9901,
    firstName: 'Alex',
    lastName: 'Rider',
    gender: 'Male',
    mobile: '9876543210',
    email: 'alex.rider@smartwaste.test',
    passwordHash,
    role: 'worker',
    address: 'Sector 4, Depot B',
    workerOnline: false,
    workerSkills: ['General Waste', 'Recycling'],
    tokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let counterVal = 100;
  t.mock.method(Counter, 'findOneAndUpdate', async () => ({ value: ++counterVal }));
  t.mock.method(AccountActivity, 'create', async () => ({}));

  t.mock.method(User, 'findOne', (query) => {
    if (query?.email === workerData.email || query?.$or?.some((b) => b.email === workerData.email || b.id === workerData.id) || query?.id === workerData.id) {
      const doc = {
        ...workerData,
        toObject() { return { ...workerData }; },
        save: async () => doc,
      };
      return {
        ...doc,
        lean: async () => ({ ...workerData }),
      };
    }
    return null;
  });

  await t.test('POST /api/auth/worker-login with worker email succeeds and returns token and user profile', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      url: '/api/auth/worker-login',
      body: { email: workerData.email, password },
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
    assert.ok(res.body?.token, 'Response should contain token');
    assert.ok(res.body?.user, 'Response should contain user profile');
    assert.equal(res.body.user.role, 'worker');
    assert.equal(res.body.user.email, workerData.email);
    assert.equal(res.body.user.id, workerData.id);
  });

  await t.test('POST /api/auth/worker-login with worker ID succeeds and returns token and user profile', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      url: '/api/auth/worker-login',
      body: { email: String(workerData.id), password },
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${res.text}`);
    assert.ok(res.body?.token, 'Response should contain token');
    assert.ok(res.body?.user, 'Response should contain user profile');
    assert.equal(res.body.user.role, 'worker');
    assert.equal(res.body.user.id, workerData.id);
  });

  await t.test('GET /api/me with worker token returns worker profile', async () => {
    const loginRes = await makeRequest(app, {
      method: 'POST',
      url: '/api/auth/worker-login',
      body: { email: workerData.email, password },
    });
    const token = loginRes.body.token;

    const meRes = await makeRequest(app, {
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(meRes.status, 200, `Expected 200, got ${meRes.status}: ${meRes.text}`);
    assert.ok(meRes.body, 'Response body should exist');
    assert.equal(meRes.body.id, workerData.id);
    assert.equal(meRes.body.role, 'worker');
    assert.equal(meRes.body.email, workerData.email);
  });
});
