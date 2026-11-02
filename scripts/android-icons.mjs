import { chromium } from '@playwright/test';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Sync the supplied web favicon pack. Native Android launcher resources are separate.
// The older SVG remains the source for the existing maskable-specific artwork only.
const root = new URL('../', import.meta.url);
const pack = new URL('branding/web/ascend-avoid-favicon-pack/', root);
await mkdir(new URL('public/icons/', root), { recursive: true });
for (const name of ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png', 'apple-touch-icon.png']) {
  await copyFile(new URL(name, pack), new URL(`public/${name}`, root));
}
for (const size of [192, 512]) {
  await copyFile(new URL(`icon-${size}.png`, pack), new URL(`public/icons/app-${size}.png`, root));
}
const svg = await readFile(new URL('public/favicon.svg', root), 'utf8');
await mkdir(new URL('public/icons/', root), { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, maskable] of [['maskable-512', 512, true]]) {
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
