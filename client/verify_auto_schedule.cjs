const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });

  await page.goto('http://localhost:3001/login', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.fill('input[name="username"], input[type="text"]', 'admin');
  await page.fill('input[name="password"], input[type="password"]', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  console.log('URL after login:', page.url());

  await page.goto('http://localhost:3001/admin/showtimes/auto', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  console.log('URL after nav:', page.url());
  await page.screenshot({ path: 'C:/Users/Legion/AppData/Local/Temp/claude/d--OJTProject-Movie-Theater/1d95c54a-f806-4c6b-a8a6-5016bd2977e2/scratchpad/auto_schedule_step1.png', fullPage: true });

  await browser.close();
})();
