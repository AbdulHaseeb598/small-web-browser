import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = process.env.BROWSER_TEST_API_URL ?? 'http://localhost:4010/api';
let personId: string;
async function go(page: Page, address: string) {
  await page.getByLabel('Fictional website address').fill(address);
  await page.getByLabel('Fictional website address').press('Enter');
}
async function search(page: Page, query: string) {
  await page.getByLabel('Search the small web').fill(query);
  await page.getByLabel('Search the small web').press('Enter');
  await expect(page.getByRole('heading', { name: 'Search results', exact: true })).toBeVisible();
}
test.beforeAll(async ({ request }) => {
  const response = await request.get(new URL('/__browser-test', api).href);
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).database).toMatch(/^small_web_browser_test_[a-f0-9]{32}$/);
});
test.beforeEach(async ({ page, request }) => {
  personId = (await (await request.post(api + '/people', { data: { name: 'UI QA ' + randomUUID().slice(0, 8) } })).json())._id;
  await page.goto('/'); await page.getByLabel('Browsing as').selectOption(personId);
  await expect(page.getByRole('heading', { name: /Follow your curiosity/ })).toBeVisible();
});

test('all seeded cards are accessible in a responsive grid and the whole main pane scrolls', async ({ page, request }, testInfo) => {
  const sites = await (await request.get(api + '/sites')).json();
  expect(sites.filter((site: { _id: string }) => site._id.startsWith('5eed2026'))).toHaveLength(10);
  await expect(page.locator('.discovery-grid button')).toHaveCount(sites.length);
  await expect(page.getByText(sites.length + ' published pages', { exact: true })).toBeVisible();
  expect(await page.locator('.discovery-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2);
  const pane = page.getByRole('region', { name: 'Current page', exact: true });
  const box = (await pane.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 10); // Caption, outside the cards.
  await page.mouse.wheel(0, 450);
  await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBeGreaterThan(200);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 1000);
  await expect(page.locator('.discovery-grid button').last()).toBeInViewport();
  for (const site of sites) await expect(page.locator('.discovery-grid').getByText(site.address, { exact: false })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('all-sites-desktop.png'), fullPage: true });
  await page.locator('.discovery-grid button').last().click();
  await expect(page.getByLabel('Fictional website address')).toHaveValue(sites[sites.length - 1].address);
});

test('catalogs larger than ten and newly published pages stay accessible without pagination', async ({ page, request }) => {
  for (let n = 0; n < 2; n++) expect((await request.post(api + '/sites', { data: { address: 'catalog-' + randomUUID().slice(0, 8) + '.zz', title: 'Extra catalog page ' + n, html: '<p>Catalog</p>', authorId: personId } })).status()).toBe(201);
  await page.reload(); await page.getByLabel('Browsing as').selectOption(personId);
  const sites = await (await request.get(api + '/sites')).json();
  expect(sites.length).toBeGreaterThan(10);
  await expect(page.locator('.discovery-grid button')).toHaveCount(sites.length);
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const address = 'new-catalog-' + randomUUID().slice(0, 8) + '.zz';
  await dialog.getByLabel('Website address').fill(address);
  await dialog.getByLabel('Website title').fill('Newly published catalog page');
  await dialog.getByLabel('HTML content').fill('<h1>New catalog page</h1>');
  await dialog.getByRole('button', { name: 'Publish website', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Website published' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close publishing form' }).click();
  await expect(page.locator('.discovery-grid button')).toHaveCount(sites.length + 1);
  await expect(page.getByText((sites.length + 1) + ' published pages', { exact: true })).toBeVisible();
  await page.locator('.discovery-grid').getByRole('button', { name: /Newly published catalog page/ }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'New catalog page' })).toBeVisible();
});

test('History wheel scrolling remains independent from main content', async ({ page }) => {
  await page.getByLabel('Browsing as').selectOption('5eed20260100000000000001');
  await expect(page.locator('.history-item')).toHaveCount(20);
  const pane = page.locator('.view-pane');
  await pane.evaluate((element) => { element.scrollTop = 200; });
  const saved = await pane.evaluate((element) => element.scrollTop);
  const history = page.locator('.history-scroll');
  const box = (await history.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => history.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
  expect(await pane.evaluate((element) => element.scrollTop)).toBe(saved);
});

test('wheel over expanded iframe content scrolls the main pane and restores A/B snapshots across people', async ({ page, request }) => {
  const addresses: string[] = [];
  for (const name of ['A', 'B']) {
    const address = 'scroll-' + randomUUID().slice(0, 8) + '.zz'; addresses.push(address);
    expect((await request.post(api + '/sites', { data: { address, title: 'Long page ' + name, html: '<h1>Long page ' + name + '</h1>' + '<p>Page text for natural wheel scrolling.</p>'.repeat(100), authorId: personId } })).status()).toBe(201);
  }
  const pane = page.locator('.view-pane');
  for (const [index, scroll] of [400, 650].entries()) {
    await go(page, addresses[index]);
    await expect.poll(() => page.locator('iframe').evaluate((element) => element.clientHeight)).toBeGreaterThan(2000);
    const box = (await pane.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, scroll);
    await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBe(scroll);
    expect(await page.frames().find((frame) => frame.url() === 'about:srcdoc')!.evaluate(() => window.scrollY)).toBe(0);
  }
  await go(page, 'tidepool.zz');
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Tidepool Field Station' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBe(650);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBe(400);
  await page.getByRole('button', { name: 'Forward', exact: true }).click();
  await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBe(650);
  await page.getByLabel('Browsing as').selectOption('5eed20260100000000000001');
  await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBe(0);
  await page.getByLabel('Browsing as').selectOption(personId);
  await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBe(650);
  await pane.focus(); await page.keyboard.press('PageDown');
  await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBeGreaterThan(650);
});

test('garden results and opened pages highlight safely and return with the original query', async ({ page }) => {
  await search(page, 'garden');
  await expect(page.locator('.result-card h2 mark').first()).toContainText(/garden/i);
  await expect(page.locator('.result-card p mark').first()).toContainText(/garden/i);
  const result = page.locator('.result-card').filter({ has: page.getByRole('heading', { name: 'Notes from the Night Garden' }) });
  await result.click();
  await expect(page.frameLocator('iframe').locator('h1 mark')).toHaveText('Garden');
  await expect(page.frameLocator('iframe').locator('p mark').first()).toHaveText(/garden/i);
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  await page.frameLocator('iframe').getByRole('link', { name: 'Open the seed library' }).click();
  await expect(page.getByLabel('Fictional website address')).toHaveValue('seed-library.zz');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.frameLocator('iframe').locator('h1 mark')).toHaveText('Garden');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Search the small web')).toHaveValue('garden');
  await expect(result.locator('h2 mark')).toHaveText('Garden');
});

test('literal special characters, body-only excerpts and XSS-like queries remain safe', async ({ page, request }) => {
  const address = 'literal-' + randomUUID().slice(0, 8) + '.zz';
  const html = '<h1>Literal text</h1>' + '<p>Unrelated opening paragraph.</p>'.repeat(20) + '<p>Special a+b (plot) and &lt;img src=x onerror=alert(1)&gt; are plain text.</p>';
  expect((await request.post(api + '/sites', { data: { address, title: 'Literal content', html, authorId: personId } })).status()).toBe(201);
  await search(page, 'a+b (plot)');
  const result = page.locator('.result-card');
  await expect(result).toHaveCount(1); await expect(result.locator('p mark')).toHaveText(['a+b', '(plot)']);
  await result.click();
  await expect(page.frameLocator('iframe').locator('p mark')).toHaveText(['a+b', '(plot)']);
  await search(page, '<img src=x onerror=alert(1)>');
  await expect(result).toHaveCount(1);
  expect(await result.locator('img,script,[onerror]').count()).toBe(0);
  await result.click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Literal text' })).toBeVisible();
  expect(await page.frameLocator('iframe').locator('img,[onerror]').count()).toBe(0);
  await search(page, 'nomatch' + randomUUID().replaceAll('-', ''));
  await expect(page.getByRole('heading', { name: 'No pages matched.' })).toBeVisible();
});

test('mobile single-column catalog supports touch scrolling', async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('.discovery-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const pane = page.locator('.view-pane');
  const box = (await pane.boundingBox())!;
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const x = box.x + box.width / 2, start = Math.min(780, box.y + box.height - 60);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
  for (let step = 1; step <= 6; step++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start - step * 40 }] });
    await page.waitForTimeout(30); // Physical gesture timing, not an assertion delay.
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
  await page.locator('.discovery-grid button').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.discovery-grid button').last()).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('catalog-mobile.png'), fullPage: true });
});
