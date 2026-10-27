import { test, expect } from '@playwright/test';

// Use real response headers with synthetic HTTPS parents. No itch.io account or DNS access is needed.
const childURL = 'https://ascend-embed-check.test/health';
async function frame(page, response, origin) {
  const parentURL = `${origin}/embedding-policy-check`;
  await page.route(childURL, route => route.fulfill({ response }));
  await page.route(parentURL, route => route.fulfill({ contentType: 'text/html', body:
    `<iframe src="${childURL}"></iframe>` }));
  // Parent load waits for each frame's navigation or failure. Firefox does not
  // emit the iframe's own load event for every policy-blocked navigation.
  await page.goto(parentURL, { waitUntil: 'load' });
}

test('embedding uses the itch.io ancestor allowlist and preserves the other security headers', async ({ request }) => {
  const response = await request.get('/health');
  expect(response.ok()).toBe(true);
  const headers = response.headers();
  expect(headers['x-frame-options']).toBeUndefined();
  const directives = new Map(headers['content-security-policy'].split(';').map(value => {
    const [name, ...sources] = value.trim().split(/\s+/); return [name, sources];
  }));
  expect(directives.get('frame-ancestors')).toEqual(["'self'", 'https://itch.io', 'https://*.itch.io', 'https://*.itch.zone']);
  expect(directives.get('default-src')).toEqual(["'self'"]);
  expect(directives.get('object-src')).toEqual(["'none'"]);
  expect(directives.get('script-src-attr')).toEqual(["'none'"]);
  expect(directives.get('script-src')[0]).toBe("'self'");
  expect(directives.get('script-src').slice(1).every(value => value.startsWith("'sha256-"))).toBe(true);
  expect(headers['strict-transport-security']).toContain('max-age=31536000');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['cross-origin-resource-policy']).toBe('same-origin');
});

test('self and approved itch.io and itch.zone parents can embed the response', async ({ page, request }) => {
  const response = await request.get('/health');
  for (const origin of ['https://ascend-embed-check.test', 'https://itch.io', 'https://games.itch.io', 'https://html-classic.itch.zone']) {
    await frame(page, response, origin);
    await expect(page.frameLocator('iframe').locator('body')).toContainText('healthy');
    await page.unrouteAll();
  }
});

test('unapproved, lookalike and insecure parents cannot embed the response', async ({ page, request, browserName }) => {
  const response = await request.get('/health');
  for (const origin of ['https://untrusted.test', 'https://itch.io.example.com', 'http://itch.io']) {
    await frame(page, response, origin);
    // Firefox exposes a browser-owned error frame; WebKit may retain the requested
    // URL with an empty blocked document. Check each engine's observable rejection.
    if (browserName === 'firefox') expect(page.frames().filter(frame => frame !== page.mainFrame()).map(frame => frame.url())).not.toContain(childURL);
    else await expect(page.frameLocator('iframe').locator('body')).not.toContainText('healthy');
    await page.unrouteAll();
  }
});
