import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const shots = '/private/var/folders/jc/8fdbnn090x785pcm0bcn2x540000gn/T/opencode/shots';
const log = [];

async function overflow(page) {
  for (let i = 0; i < 5; i++) {
    try {
      return await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return -1;
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle0', timeout: 20000 });
await (await page.$('input[type="email"]')).type('user@smartwaste.com');
await (await page.$('input[type="password"]')).type('User#123');
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {});
log.push('login ok: ' + page.url());

const routes = ['/tickets', '/hire-worker', '/profile', '/settings'];
for (const width of [1440, 390]) {
  await page.setViewport({ width, height: 900 });
  for (const route of routes) {
    await page.goto(`http://localhost:4200${route}`, { waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {});
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    const name = route.slice(1) || 'home';
    const o = await overflow(page);
    log.push(`${route} @${width}: overflow=${o}px url=${page.url()}`);
    if (width === 390) await page.screenshot({ path: `${shots}/mod-${name}-390.png` });
  }
}

await browser.close();
console.log(log.join('\n'));
