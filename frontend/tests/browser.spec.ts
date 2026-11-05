import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = process.env.BROWSER_TEST_API_URL ?? 'http://localhost:4010/api';
let personId: string;
test.beforeAll(async ({ request }) => {
  const fixture = await request.get(new URL('/__browser-test', api).href);
  expect(fixture.ok(), 'Browser tests require the isolated browser-test-server fixture').toBeTruthy();
  expect((await fixture.json()).database).toMatch(/^small_web_browser_test_[a-f0-9]{32}$/);
});
async function go(page: Page, address: string) {
  await page.getByLabel('Fictional website address').fill(address);
  await page.getByLabel('Fictional website address').press('Enter');
}
test.beforeEach(async ({ page, request }) => {
  const response = await request.post(api + '/people', { data: { name: 'Browser QA ' + randomUUID().slice(0, 8) } });
  expect(response.ok()).toBeTruthy();
  personId = (await response.json())._id;
  await page.goto('/');
  await page.getByLabel('Browsing as').selectOption(personId);
  await expect(page.getByText('No visits yet.', { exact: false })).toBeVisible();
});

test('keyboard links, application and native traversal, missing history and stack truncation', async ({ page, request }) => {
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
  await go(page, 'tidepool.zz');
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('heading', { name: 'Tidepool Field Station' })).toBeVisible();
  await frame.getByRole('link', { name: 'Read the kelp survey' }).focus();
  await frame.getByRole('link', { name: 'Read the kelp survey' }).press('Enter');
  await expect(page.getByLabel('Fictional website address')).toHaveValue('kelp-lab.zz');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(frame.getByRole('heading', { name: 'Tidepool Field Station' })).toBeVisible();
  await page.getByRole('button', { name: 'Forward', exact: true }).click();
  await expect(page.getByLabel('Fictional website address')).toHaveValue('kelp-lab.zz');
  await page.goBack();
  await expect(page.getByLabel('Fictional website address')).toHaveValue('tidepool.zz');
  await frame.getByRole('link', { name: /old moon pier/ }).click();
  await expect(page.getByRole('heading', { name: 'This address has no page.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forward', exact: true })).toBeDisabled();
  await expect(page.getByText('Missing page', { exact: true })).toBeVisible();
  await page.locator('.history-item').first().click();
  await expect.poll(async () => (await (await request.get(api + '/people/' + personId + '/visits')).json()).total).toBe(7);
  const history = await (await request.get(api + '/people/' + personId + '/visits')).json();
  expect(history.items.map((item: { method: string }) => item.method)).toEqual(['history', 'link', 'back', 'forward', 'back', 'link', 'typed']);
});

test('body search results restore without another search request and people retain separate sessions', async ({ page, request }) => {
  let searches = 0;
  page.on('request', (req) => { if (req.url().includes('/api/search?')) searches++; });
  await page.getByLabel('Search the small web').fill('"Temperature drift"');
  await page.getByLabel('Search the small web').press('Enter');
  await expect(page.locator('.result-card')).toHaveCount(1);
  await page.locator('.result-card').click();
  await expect(page.locator('iframe')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Search the small web')).toHaveValue('"Temperature drift"');
  await expect(page.locator('.result-card')).toHaveCount(1);
  expect(searches).toBe(1);
  const people = await (await request.get(api + '/people')).json();
  await page.getByLabel('Browsing as').selectOption(people.find((p: { _id: string }) => p._id !== personId)._id);
  await expect(page.getByRole('heading', { name: /Follow your curiosity/ })).toBeVisible();
  await page.getByLabel('Browsing as').selectOption(personId);
  await expect(page.getByLabel('Search the small web')).toHaveValue('"Temperature drift"');
  const history = await (await request.get(api + '/people/' + personId + '/visits')).json();
  expect(history.items.map((item: { method: string }) => item.method)).toEqual(['search']);
});

test('return restores captured HTML and scroll without refetching; new visit fetches fresh HTML', async ({ page, request }) => {
  const address = 'snapshot-' + randomUUID().slice(0, 8) + '.zz';
  expect((await request.post(api + '/sites', { data: { address, title: 'Snapshot', authorId: personId, html: '<h1>Original snapshot</h1>' + '<p>Long page text</p>'.repeat(120) } })).ok()).toBeTruthy();
  let reads = 0;
  await page.route('**/api/sites/' + address, async (route) => {
    reads++;
    if (reads === 1) await route.continue();
    else { const response = await route.fetch(); const data = await response.json(); await route.fulfill({ json: { ...data, html: '<h1>Changed snapshot</h1>' } }); }
  });
  await go(page, address);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Original snapshot' })).toBeVisible();
  await page.locator('iframe').evaluate((frame: HTMLIFrameElement) => frame.contentWindow?.postMessage({}, '*'));
  const content = page.frames().find((frame) => frame.url() === 'about:srcdoc')!;
  await content.waitForLoadState('load');
  await content.evaluate(() => window.scrollTo(0, 650));
  await expect.poll(() => content.evaluate(() => window.scrollY)).toBe(650);
  await page.waitForTimeout(250); // Bridge publishes scroll on a throttled animation frame.
  await go(page, 'tidepool.zz');
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Tidepool Field Station' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Original snapshot' })).toBeVisible();
  expect(await page.locator('iframe').getAttribute('srcdoc')).toContain('scrollTo(0,650)');
  await expect.poll(() => page.frames().find((frame) => frame.url() === 'about:srcdoc')!.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  expect(reads).toBe(1);
  await go(page, address);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Changed snapshot' })).toBeVisible();
  expect(reads).toBe(2);
});

test('malicious HTML stays opaque, loses active content and cannot issue resource requests', async ({ page, request }) => {
  const address = 'unsafe-' + randomUUID().slice(0, 8) + '.zz';
  const external: string[] = [];
  page.on('request', (req) => { if (req.url().includes('evil.example')) external.push(req.url()); });
  expect((await request.post(api + '/sites', { data: { address, title: 'Unsafe fixture', authorId: personId, html: `<h1>Contained page</h1><script>parent.hacked=true</script><img src="https://evil.example/track" onerror="parent.hacked=true"><form action="https://evil.example"><input autofocus></form><iframe src="https://evil.example"></iframe><a href="javascript:parent.hacked=true">Bad script</a><a href="https://evil.example">External</a><a href="tidepool.zz">Safe link</a>` } })).ok()).toBeTruthy();
  await go(page, address);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Contained page' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  const content = page.frames().find((frame) => frame.url() === 'about:srcdoc')!;
  const boundary = await content.evaluate(async () => {
    let parentBlocked = false, storageBlocked = false, networkBlocked = false;
    try { void parent.document.body; } catch { parentBlocked = true; }
    try { void localStorage.length; } catch { storageBlocked = true; }
    try { await fetch('http://localhost:4010/api/people'); } catch { networkBlocked = true; }
    return { parentBlocked, storageBlocked, networkBlocked, active: document.querySelectorAll('img,form,iframe,input,[onerror]').length };
  });
  expect(boundary).toEqual({ parentBlocked: true, storageBlocked: true, networkBlocked: true, active: 0 });
  expect(await page.evaluate(() => 'hacked' in window)).toBeFalsy();
  expect(external).toEqual([]);
  await page.frameLocator('iframe').getByRole('link', { name: 'Safe link' }).click();
  await expect(page.getByLabel('Fictional website address')).toHaveValue('tidepool.zz');
});

test('mobile layout fits and exposes history access', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Browsing history' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
});

test('rapid navigation ignores stale responses and API failure preserves the current page', async ({ page, request }) => {
  let release: (() => void) | undefined;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  await page.route('**/api/sites/tidepool.zz', async (route) => {
    requested = true;
    await delayed;
    await route.fulfill({ status: 503, json: { message: 'Delayed failure' } }).catch(() => {});
  });
  await go(page, 'tidepool.zz');
  await expect.poll(() => requested).toBeTruthy();
  await go(page, 'kelp-lab.zz');
  await expect(page.locator('iframe')).toBeVisible();
  release!();
  await expect(page.getByLabel('Fictional website address')).toHaveValue('kelp-lab.zz');
  await page.route('**/api/sites/observatory.zz', (route) => route.fulfill({ status: 503, json: { message: 'Unavailable' } }));
  await go(page, 'observatory.zz');
  await expect(page.locator('.error-notice')).toContainText('could not be loaded');
  await expect(page.locator('iframe')).toHaveAttribute('title', /Kelp/);
  await expect.poll(async () => (await (await request.get(api + '/people/' + personId + '/visits')).json()).total).toBe(1);
});
