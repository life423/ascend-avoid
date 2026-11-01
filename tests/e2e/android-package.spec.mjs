import {test,expect} from '@playwright/test';
import {openLesson} from './helpers/practice.mjs';

test.skip(!process.env.ANDROID_E2E,'explicit Android website integration checks');

test('install metadata and correctly sized icons are served from the game origin',async({request})=>{
  const response=await request.get('/manifest.webmanifest');expect(response.status()).toBe(200);
  const manifest=await response.json();expect(manifest.name).toBe('Ascend Avoid');expect(manifest.scope).toBe('/');expect(manifest.start_url).toBe('/');
  expect(manifest.icons.some(icon=>icon.purpose==='maskable')).toBe(true);
  for(const icon of manifest.icons){
    const asset=await request.get(icon.src);expect(asset.status()).toBe(200);expect(asset.headers()['content-type']).toContain('image/png');
    const bytes=await asset.body(),[width,height]=icon.sizes.split('x').map(Number);
    expect(bytes.readUInt32BE(16)).toBe(width);expect(bytes.readUInt32BE(20)).toBe(height);
  }
});

test('only the public Digital Asset Links file is exposed from the dot directory',async({request})=>{
  const response=await request.get('/.well-known/assetlinks.json');expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('application/json');
  const entries=await response.json();expect(Array.isArray(entries)).toBe(true);
  const entry=entries.find(item=>item.target.package_name==='io.drewclark.ascendavoid');
  expect(entry.relation).toContain('delegate_permission/common.handle_all_urls');
  for(const fingerprint of entry.target.sha256_cert_fingerprints)expect(fingerprint).toMatch(/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/);
  for(const path of ['/.env','/.well-known/not-a-public-file','/android/local.properties'])expect((await request.get(path)).status()).toBe(404);
});

test('the app launch page keeps normal gameplay and the tutorial available',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openLesson(page,'combat');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href','/manifest.webmanifest');
  await expect(page.locator('.practice-instruction')).toContainText('Your captive waits here');
  const canvas=page.locator('canvas.game-canvas'),bounds=await canvas.boundingBox(),viewport=page.viewportSize();
  expect(Math.abs(bounds.width-viewport.width)).toBeLessThan(2);expect(Math.abs(bounds.height-viewport.height)).toBeLessThan(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThan(2);
  await page.screenshot({path:test.info().outputPath('android-site-ready.png'),scale:'css'});
  expect(errors).toEqual([]);
});
