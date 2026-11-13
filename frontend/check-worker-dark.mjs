import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const shots = '/private/var/folders/jc/8fdbnn090x785pcm0bcn2x540000gn/T/opencode/shots';
const log = [];

async function login(page, origin, email, password) {
  await page.goto(`${origin}/login`, { waitUntil: 'networkidle0', timeout: 20000 });
  const emailInput = await page.$('input[type="email"]');
  await emailInput.type(email);
  const pw = await page.$('input[type="password"]');
  await pw.type(password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await new Promise((r) => setTimeout(r, 3500));
  log.push(`after login url: ${page.url()}`);
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {});
}

const overflow = async (page) => {
  for (let i = 0; i < 5; i++) {
    try {
      return await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return -1;
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars'],
});

// Worker portal at 390px
const w = await browser.newPage();
await w.setViewport({ width: 390, height: 844 });
await login(w, 'http://localhost:4400', 'worker@smartwaste.com', 'Worker#123');
log.push('worker 390 overflow: ' + (await overflow(w)));
await w.screenshot({ path: `${shots}/worker-dash-390.png` });

// Dark mode on public portal
const d = await browser.newPage();
await d.setViewport({ width: 1440, height: 900 });
await login(d, 'http://localhost:4200', 'user@smartwaste.com', 'User#123');
await d.evaluate(() => localStorage.setItem('swms_theme', 'dark'));
await d.reload({ waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2000));
log.push('dark overflow: ' + (await overflow(d)));
await d.screenshot({ path: `${shots}/dash-dark-1440.png` });

await browser.close();
console.log(log.join('\n'));
