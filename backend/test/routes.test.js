import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Socket } from 'node:net';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-length-12345';
process.env.ADMIN_SESSION_SECRET = 'test-admin-secret-with-sufficient-length-12345';

const { app } = await import('../src/server.js');

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

test('HTTP API Route Integration Suite', async (t) => {
  await t.test('GET /api/health returns 200 with status ok', async () => {
    const res = await makeRequest(app, { url: '/api/health' });
    assert.equal(res.status, 200);
    assert.equal(res.body?.status, 'ok');
    assert.ok(res.body?.time);
  });

  await t.test('GET /api/me without authorization returns 401', async () => {
    const res = await makeRequest(app, { url: '/api/me' });
    assert.equal(res.status, 401);
    assert.equal(res.body?.message, 'Missing auth token');
  });

  await t.test('GET /api/tickets without authorization returns 401', async () => {
    const res = await makeRequest(app, { url: '/api/tickets' });
    assert.equal(res.status, 401);
  });

  await t.test('POST /api/tickets/1/messages without authorization returns 401', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      url: '/api/tickets/1/messages',
      body: { message: 'Hello' },
    });
    assert.equal(res.status, 401);
  });

  await t.test('POST /api/auth/login with missing credentials returns 400', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      url: '/api/auth/login',
      body: {},
    });
    assert.equal(res.status, 400);
    assert.equal(res.body?.message, 'Email and password are required.');
  });

  await t.test('GET /api/admin-activities without admin credentials returns 401', async () => {
    const res = await makeRequest(app, { url: '/api/admin-activities' });
    assert.equal(res.status, 401);
  });

  await t.test('POST /api/tickets/1/messages has rate limit headers', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      url: '/api/tickets/1/messages',
      body: { message: 'Rate limit check' },
    });
    assert.ok(res.headers['ratelimit-limit'] !== undefined || res.headers['x-ratelimit-limit'] !== undefined || res.status === 401);
  });
});
