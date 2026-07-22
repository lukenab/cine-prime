const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });

  await page.goto('http://localhost:3001/login', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.fill('input[name="username"], input[type="text"]', 'admin');
  await page.fill('input[name="password"], input[type="password"]', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  await page.goto('http://localhost:3001/admin/showtimes/auto', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  await page.getByText('All active clusters', { exact: false }).click();
  // select every visible movie checkbox to maximize chance of at least one eligible candidate
  const movieLabels = await page.locator('label:has(svg + span)').allTextContents().catch(() => []);
  const allMovieCheckboxes = page.locator('div.rounded-2xl:has-text("Movies") input[type="checkbox"]');
  const count = await allMovieCheckboxes.count();
  for (let i = 0; i < count; i++) {
    await allMovieCheckboxes.nth(i).click();
  }
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Review' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Submit run/ }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Legion/AppData/Local/Temp/claude/d--OJTProject-Movie-Theater/1d95c54a-f806-4c6b-a8a6-5016bd2977e2/scratchpad/step_running2.png' });

  const runNowBtn = page.getByRole('button', { name: /Run now/ });
  if (await runNowBtn.count() > 0) {
    await runNowBtn.click();
    await page.waitForTimeout(4000);
  }
  await page.screenshot({ path: 'C:/Users/Legion/AppData/Local/Temp/claude/d--OJTProject-Movie-Theater/1d95c54a-f806-4c6b-a8a6-5016bd2977e2/scratchpad/step_results.png', fullPage: true });
  console.log('final URL:', page.url());

  await browser.close();
})();
