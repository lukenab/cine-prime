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
  await page.waitForTimeout(1500);

  await page.goto('http://localhost:3001/admin/showtimes/auto', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // Select a cluster and a couple movies
  await page.getByText('CinePrime Hoàn Kiếm', { exact: true }).click();
  await page.getByText('Inception', { exact: true }).click();
  await page.getByText('Dune: Part Two', { exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'C:/Users/Legion/AppData/Local/Temp/claude/d--OJTProject-Movie-Theater/1d95c54a-f806-4c6b-a8a6-5016bd2977e2/scratchpad/step_scope_selected.png' });

  await page.getByRole('button', { name: 'Review' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Users/Legion/AppData/Local/Temp/claude/d--OJTProject-Movie-Theater/1d95c54a-f806-4c6b-a8a6-5016bd2977e2/scratchpad/step_review.png' });

  await page.getByRole('button', { name: /Submit run/ }).click();
  await page.waitForTimeout(1500);
  console.log('After submit, URL:', page.url());
  await page.screenshot({ path: 'C:/Users/Legion/AppData/Local/Temp/claude/d--OJTProject-Movie-Theater/1d95c54a-f806-4c6b-a8a6-5016bd2977e2/scratchpad/step_running.png' });

  // Try "Run now" to skip the ~60s scheduler wait
  const runNowBtn = page.getByRole('button', { name: /Run now/ });
  if (await runNowBtn.count() > 0) {
    await runNowBtn.click();
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: 'C:/Users/Legion/AppData/Local/Temp/claude/d--OJTProject-Movie-Theater/1d95c54a-f806-4c6b-a8a6-5016bd2977e2/scratchpad/step_after_runnow.png', fullPage: true });

  await browser.close();
})();
