import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const shots = '/private/var/folders/jc/8fdbnn090x785pcm0bcn2x540000gn/T/opencode/shots';
const log = [];

async function login(page) {
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle0', timeout: 20000 });
  await page.type('input[type="email"], input[formcontrolname="email"], #email', 'user@smartwaste.com');
  const pw = await page.$('input[type="password"]');
  await pw.type('User#123');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"], .btn-primary[type="submit"]'),
  ]);
  await new Promise((r) => setTimeout(r, 2500));
  log.push('after login url: ' + page.url());
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars'],
});

// Desktop dashboard
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await login(page);
await page.screenshot({ path: `${shots}/dash-1440.png` });
log.push('1440 overflow: ' + (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)));

// Hamburger drawer open
await page.click('.mobile-menu-btn, button[aria-label*="Toggle navigation"]');
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: `${shots}/drawer-1440.png` });
log.push('drawer shot taken');

// Mobile dashboard + drawer
const page2 = await browser.newPage();
await page2.setViewport({ width: 390, height: 844 });
await login(page2);
await page2.screenshot({ path: `${shots}/dash-390.png` });
log.push('390 overflow: ' + (await page2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)));
await page2.click('.mobile-menu-btn, button[aria-label*="Toggle navigation"]');
await new Promise((r) => setTimeout(r, 700));
await page2.screenshot({ path: `${shots}/drawer-390.png` });

console.log(log.join('\n'));
await browser.close();
