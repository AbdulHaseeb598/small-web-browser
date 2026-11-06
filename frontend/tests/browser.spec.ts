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
async function publish(page: Page, address: string, html: string, publisher: string, title = 'Published QA page') {
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Publisher', { exact: true }).selectOption(publisher);
  await dialog.getByLabel('Website address').fill(address);
  await dialog.getByLabel('Website title').fill(title);
  await dialog.getByLabel('HTML content').fill(html);
  await dialog.getByRole('button', { name: 'Publish website', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Website published' })).toBeVisible();
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
  await expect.poll(() => page.frames().find((frame) => frame.url() === 'about:srcdoc')!.evaluate(() => window.scrollY)).toBe(650);
  expect(reads).toBe(1);
  await go(page, address);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Changed snapshot' })).toBeVisible();
  expect(reads).toBe(2);
});

test('published malicious HTML stays opaque, loses active content and cannot issue resource requests', async ({ page }) => {
  const address = 'unsafe-' + randomUUID().slice(0, 8) + '.zz';
  const external: string[] = [];
  page.on('request', (req) => { if (req.url().includes('evil.example')) external.push(req.url()); });
  await publish(page, address, `<h1>Contained page</h1><script>window.hacked=true;parent.hacked=true;top.location='https://evil.example'</script><img src="https://evil.example/track" onerror="parent.hacked=true"><form action="https://evil.example"><input autofocus><button formaction="https://evil.example">Send</button></form><iframe src="https://evil.example" srcdoc="<script>top.location='https://evil.example'</script>"></iframe><object data="https://evil.example"></object><embed src="https://evil.example"><link rel="stylesheet" href="https://evil.example/style"><style>@import 'https://evil.example/css';body{background:url(https://evil.example/bg)}</style><p style="background:url(https://evil.example/inline)" onclick="parent.hacked=true">Safe paragraph</p><meta http-equiv="refresh" content="0;url=https://evil.example"><base href="https://evil.example"><a href="javascript:parent.hacked=true">Bad script</a><a href="data:text/html,unsafe">Data</a><a href="blob:https://evil.example/id">Blob</a><a href="https://evil.example" target="_top" ping="https://evil.example">External</a><a href="tidepool.zz">Safe link</a><svg onload="parent.hacked=true"></svg><math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>`, personId, 'Unsafe fixture');
  await page.getByRole('button', { name: 'Open published site' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Contained page' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  const content = page.frames().find((frame) => frame.url() === 'about:srcdoc')!;
  const boundary = await content.evaluate(async () => {
    let parentBlocked = false, storageBlocked = false, networkBlocked = false, cookiesBlocked = false, navigationBlocked = false;
    try { void parent.document.body; } catch { parentBlocked = true; }
    try { void localStorage.length; } catch { storageBlocked = true; }
    try { void document.cookie; } catch { cookiesBlocked = true; }
    try { top!.location.href = 'https://evil.example/escape'; } catch { navigationBlocked = true; }
    try { await fetch('http://localhost:4010/api/people'); } catch { networkBlocked = true; }
    return { parentBlocked, storageBlocked, networkBlocked, cookiesBlocked, navigationBlocked, executed: 'hacked' in window, active: document.querySelectorAll('img,form,iframe,input,object,embed,link,svg,math,[onerror],[onclick],[style]').length };
  });
  expect(boundary).toEqual({ parentBlocked: true, storageBlocked: true, networkBlocked: true, cookiesBlocked: true, navigationBlocked: true, executed: false, active: 0 });
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

test('publishing integrates separate authorship, links, missing pages, search and correct visit identity', async ({ page, request }, testInfo) => {
  const people = await (await request.get(api + '/people')).json();
  const authorId = people.find((person: { _id: string }) => person._id !== personId)._id;
  const address = 'published-' + randomUUID().slice(0, 8) + '.zz';
  const needle = 'unique' + randomUUID().replaceAll('-', '');
  const html = '<h1>New published page</h1><p>' + needle + '</p><a href="tidepool.zz">Explore the tidepool</a><a href="unpublished-qa.zz">Broken trail</a>';
  let submissions = 0;
  page.on('request', (req) => { if (req.method() === 'POST' && req.url() === api + '/sites') submissions++; });
  await publish(page, address.toUpperCase(), html, authorId, 'Publisher <notes>');
  const stored = await (await request.get(api + '/sites/' + address)).json();
  expect(stored).toMatchObject({ address, html, authorId, title: 'Publisher <notes>' });
  expect(submissions).toBe(1);
  await page.getByRole('button', { name: 'Open published site' }).click();
  await expect(page.getByLabel('Browsing as')).toHaveValue(personId);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'New published page' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('published-desktop.png'), fullPage: true });
  await page.frameLocator('iframe').getByRole('link', { name: 'Explore the tidepool' }).click();
  await expect(page.getByLabel('Fictional website address')).toHaveValue('tidepool.zz');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'New published page' })).toBeVisible();
  await page.frameLocator('iframe').getByRole('link', { name: 'Broken trail' }).click();
  await expect(page.getByRole('heading', { name: 'This address has no page.' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'New published page' })).toBeVisible();
  await page.getByLabel('Search the small web').fill(needle);
  await page.getByLabel('Search the small web').press('Enter');
  await expect(page.locator('.result-card')).toHaveCount(1);
  await page.locator('.result-card').click();
  await expect(page.locator('iframe')).toBeVisible();
  await expect.poll(async () => (await (await request.get(api + '/people/' + personId + '/visits')).json()).total).toBe(6);
  const history = await (await request.get(api + '/people/' + personId + '/visits')).json();
  expect(history.items.every((item: { personId: string }) => item.personId === personId)).toBeTruthy();
  expect(history.items[0]).toMatchObject({ address, method: 'search' });
});

test('publishing preserves draft through server failure and duplicate address, then succeeds on retry', async ({ page, request }) => {
  const address = 'duplicate-' + randomUUID().slice(0, 8) + '.zz';
  expect((await request.post(api + '/sites', { data: { address, title: 'Existing page', html: '<p>Existing</p>', authorId: personId } })).status()).toBe(201);
  let submissions = 0;
  await page.route('**/api/sites', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    submissions++;
    if (submissions === 1) return route.fulfill({ status: 503, json: { message: 'Temporary failure' } });
    await route.continue();
  });
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Website address').fill(address);
  await dialog.getByLabel('Website title').fill('Retained draft');
  await dialog.getByLabel('HTML content').fill('<h1>Retained original</h1>');
  await dialog.getByRole('button', { name: 'Publish website', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
  await expect(dialog.getByLabel('HTML content')).toHaveValue('<h1>Retained original</h1>');
  await dialog.getByRole('button', { name: 'Publish website', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('already published');
  await expect(dialog.getByLabel('Website title')).toHaveValue('Retained draft');
  await dialog.getByLabel('Website address').fill('retry-' + randomUUID().slice(0, 8) + '.zz');
  await dialog.getByRole('button', { name: 'Publish website', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Website published' })).toBeVisible();
  expect(submissions).toBe(3);
  await dialog.getByRole('button', { name: 'Close publishing form' }).click();
  await expect(page.getByRole('heading', { name: /Follow your curiosity/ })).toBeVisible();
  expect((await (await request.get(api + '/people/' + personId + '/visits')).json()).total).toBe(0);
});

test('four linked pages support native Forward, repeated visits, identity switching and reload reset', async ({ page, request }) => {
  await go(page, 'tidepool.zz');
  for (const [label, address] of [
    ['Read the kelp survey', 'kelp-lab.zz'],
    ['Follow nutrients into the night garden', 'night-garden.zz'],
    ['Open the seed library', 'seed-library.zz'],
  ]) {
    await page.frameLocator('iframe').getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByLabel('Fictional website address')).toHaveValue(address);
  }
  await page.goBack(); await expect(page.getByLabel('Fictional website address')).toHaveValue('night-garden.zz');
  await page.goForward(); await expect(page.getByLabel('Fictional website address')).toHaveValue('seed-library.zz');
  await go(page, 'seed-library.zz');
  await expect.poll(async () => (await (await request.get(api + '/people/' + personId + '/visits')).json()).total).toBe(7);
  const second = await (await request.post(api + '/people', { data: { name: 'Other browser ' + randomUUID().slice(0, 8) } })).json();
  // Reload refreshes the people list and intentionally resets in-memory sessions.
  await page.reload(); await page.getByLabel('Browsing as').selectOption(personId);
  await expect(page.getByRole('heading', { name: /Follow your curiosity/ })).toBeVisible();
  await go(page, 'tidepool.zz');
  await page.getByLabel('Browsing as').selectOption(second._id);
  await expect(page.getByRole('heading', { name: /Follow your curiosity/ })).toBeVisible();
  await expect(page.getByText('No visits yet.', { exact: false })).toBeVisible();
  await go(page, 'kelp-lab.zz');
  await expect(page.locator('iframe')).toBeVisible();
  await page.getByLabel('Browsing as').selectOption(personId);
  await expect(page.getByLabel('Fictional website address')).toHaveValue('tidepool.zz');
  await expect.poll(async () => (await (await request.get(api + '/people/' + second._id + '/visits')).json()).total).toBe(1);
  expect((await (await request.get(api + '/people/' + personId + '/visits')).json()).total).toBe(8);
});

test('search results restore their scroll position and query without refetch', async ({ page }) => {
  let searches = 0;
  page.on('request', (req) => { if (req.url().includes('/api/search?')) searches++; });
  await page.getByLabel('Search the small web').fill('a');
  await page.getByLabel('Search the small web').press('Enter');
  await expect(page.getByRole('heading', { name: 'Search results', exact: true })).toBeVisible();
  const results = page.locator('.search-results');
  await results.evaluate((element) => { element.scrollTop = 350; });
  await expect.poll(() => results.evaluate((element) => element.scrollTop)).toBeGreaterThan(300);
  const result = page.locator('.result-card').nth(3);
  await result.scrollIntoViewIfNeeded();
  const savedScroll = await results.evaluate((element) => element.scrollTop);
  await result.click();
  await expect(page.locator('iframe')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(results).toBeVisible();
  await expect.poll(() => results.evaluate((element) => element.scrollTop)).toBe(savedScroll);
  await expect(page.getByLabel('Search the small web')).toHaveValue('a');
  expect(searches).toBe(1);
});

test('forged window messages and synthetic iframe clicks cannot create visits', async ({ page, request }) => {
  await go(page, 'tidepool.zz');
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Tidepool Field Station' })).toBeVisible();
  const token = await page.locator('iframe').evaluate((element: HTMLIFrameElement) => /const token = "([^"]+)"/.exec(element.srcdoc)![1]);
  await page.evaluate((token) => {
    const frame = document.querySelector('iframe')!;
    for (const source of [window, frame.contentWindow]) {
      window.dispatchEvent(new MessageEvent('message', { source, origin: 'null', data: { token, type: 'link', value: 'kelp-lab.zz' } }));
    }
    window.postMessage({ token, type: 'link', value: 'kelp-lab.zz' }, '*');
  }, token);
  const content = page.frames().find((frame) => frame.url() === 'about:srcdoc')!;
  await content.evaluate((token) => {
    for (const data of [
      { token: 'wrong', type: 'link', value: 'kelp-lab.zz' },
      { token, type: 'link', value: 'observatory.zz' }, // Valid address, absent from this page.
      { token, type: 'link', value: 'javascript:alert(1)' },
      { token, type: 'link', value: 'kelp-lab.zz', extra: true },
      { token, type: 'scroll', value: -Infinity },
    ]) parent.postMessage(data, '*');
    document.querySelector<HTMLAnchorElement>('a')!.click();
  }, token);
  await expect(page.getByLabel('Fictional website address')).toHaveValue('tidepool.zz');
  await expect.poll(async () => (await (await request.get(api + '/people/' + personId + '/visits')).json()).total).toBe(1);
  await page.frameLocator('iframe').getByRole('link', { name: 'Read the kelp survey' }).click();
  await expect(page.getByLabel('Fictional website address')).toHaveValue('kelp-lab.zz');
});

test('mobile publishing dialog supports keyboard submission and Escape with no horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Publish', exact: true }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('publish-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeFocused();
});

test('deeply nested authored HTML remains browsable and searchable', async ({ page }) => {
  const address = 'deep-' + randomUUID().slice(0, 8) + '.zz';
  const needle = 'deep' + randomUUID().replaceAll('-', '');
  await publish(page, address, '<h1>Deep page</h1><a href="tidepool.zz">Safe escape</a>' + '<div>'.repeat(9000) + needle + '</div>'.repeat(9000), personId);
  await page.getByRole('button', { name: 'Open published site' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Deep page' })).toBeVisible();
  await page.getByLabel('Search the small web').fill(needle);
  await page.getByLabel('Search the small web').press('Enter');
  await expect(page.locator('.result-card')).toHaveCount(1);
  await page.locator('.result-card').click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Deep page' })).toBeVisible();
  await page.frameLocator('iframe').getByRole('link', { name: 'Safe escape' }).click();
  await expect(page.getByLabel('Fictional website address')).toHaveValue('tidepool.zz');
});
