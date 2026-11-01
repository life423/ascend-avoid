import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Rasterize the existing vector brand mark; no new runtime graphics dependency.
const root = new URL('../', import.meta.url);
const svg = await readFile(new URL('public/favicon.svg', root), 'utf8');
await mkdir(new URL('public/icons/', root), { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, maskable] of [['app-192', 192, false], ['app-512', 512, false], ['maskable-512', 512, true]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent('<html><body style="margin:0;background:#001b34"></body></html>');
    await page.evaluate(({ svg, size, maskable }) => {
      const mark = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
      if (maskable) mark.querySelector('rect[stroke]')?.remove();
      mark.setAttribute('width', String(maskable ? size * .72 : size));
      mark.setAttribute('height', String(maskable ? size * .72 : size));
      if (maskable) mark.style.margin = `${size * .14}px`;
      document.body.append(document.importNode(mark, true));
    }, { svg, size, maskable });
    await page.screenshot({ path: fileURLToPath(new URL(`public/icons/${name}.png`, root)), scale: 'css' });
  }
} finally { await browser.close(); }
