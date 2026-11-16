import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Render keeps public and admin backends isolated and checks readiness', async () => {
  const yaml = await readFile(new URL('../../render.yaml', import.meta.url), 'utf8');
  const publicService = yaml.slice(yaml.indexOf('name: smartwaste-backend'), yaml.indexOf('name: smartwaste-admin-backend'));
  const adminService = yaml.slice(yaml.indexOf('name: smartwaste-admin-backend'), yaml.indexOf('name: smartwasteportal'));

  assert.match(publicService, /healthCheckPath: \/api\/ready/);
  assert.match(publicService, /key: SERVICE_MODE\s+value: public/);
  assert.match(adminService, /healthCheckPath: \/api\/ready/);
  assert.match(adminService, /key: SERVICE_MODE\s+value: admin/);
  assert.match(adminService, /key: FIREBASE_SERVICE_ACCOUNT_JSON/);
});
