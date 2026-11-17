import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000/api';
const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPathPublic = join(__dirname, '..', 'public', 'assets', 'runtime-config.js');

// The console is fixed by the build, so a worker deploy never falls back to the
// citizen login (and its Google button) when the hostname is not recognised.
const consoleMode = process.argv[2];
const consoles = ['citizen', 'worker', 'admin'];

const payload = {
  API_BASE_URL: apiBaseUrl,
  ...(process.env.API_WAKE_URL ? { API_WAKE_URL: process.env.API_WAKE_URL } : {}),
  DEPLOY_COMMIT: process.env.RENDER_GIT_COMMIT || 'local',
  ...(process.env.GOOGLE_MAPS_API_KEY ? { GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY } : {}),
  ...(consoles.includes(consoleMode) ? { CONSOLE_MODE: consoleMode } : {}),
  // Optional: run the client against the local Firebase Auth emulator for e2e tests.
  ...(process.env.FIREBASE_AUTH_EMULATOR ? { FIREBASE_AUTH_EMULATOR: process.env.FIREBASE_AUTH_EMULATOR } : {}),
};

const content = `window.__SWMS_CONFIG__ = ${JSON.stringify(payload, null, 2)};\n`;
mkdirSync(dirname(outputPathPublic), { recursive: true });
writeFileSync(outputPathPublic, content);
console.log(`Runtime config written to ${outputPathPublic}`);
