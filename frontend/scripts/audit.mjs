import { execFileSync } from 'node:child_process';

// No patched release exists for this advisory (picomatch through 4.0.7), and it
// reaches us only through Angular/Vite build tooling, never shipped code.
const ALLOWED = new Map([
  ['GHSA-fc5q-39xc-vjpf', 'picomatch ReDoS'],
]);

function audit(args) {
  try {
    return JSON.parse(execFileSync('npm', ['audit', '--json', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } catch (error) {
    if (!error.stdout) throw error;
    return JSON.parse(error.stdout);
  }
}

function advisories(report) {
  const found = new Map();
  for (const item of Object.values(report.vulnerabilities ?? {})) {
    for (const via of item.via ?? []) {
      if (typeof via === 'object' && via.url) {
        found.set(via.url.split('/').pop(), via.title ?? via.url);
      }
    }
  }
  return found;
}

const shipped = advisories(audit(['--omit=dev']));
if (shipped.size) {
  for (const [id, title] of shipped) console.error(`Shipped dependency advisory: ${id} (${title})`);
  process.exit(1);
}

const buildOnly = [...advisories(audit([]))].filter(([id]) => !ALLOWED.has(id));
if (buildOnly.length) {
  for (const [id, title] of buildOnly) console.error(`Unreviewed build-tool advisory: ${id} (${title})`);
  process.exit(1);
}

console.log(`Audit clean: 0 shipped advisories; ${ALLOWED.size} documented build-tool advisory allowed.`);
