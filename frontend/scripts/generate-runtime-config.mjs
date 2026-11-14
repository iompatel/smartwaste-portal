import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000/api';
const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, '..', 'src', 'assets', 'runtime-config.js');

const payload = {
  API_BASE_URL: apiBaseUrl,
  DEPLOY_COMMIT: process.env.RENDER_GIT_COMMIT || 'local',
};

const content = `window.__SWMS_CONFIG__ = ${JSON.stringify(payload, null, 2)};\n`;
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, content);
console.log(`Runtime config written to ${outputPath}`);
