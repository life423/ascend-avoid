// Disposable localhost review page; the next normal client build removes it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = buildSync({ absWorkingDir: root, entryPoints: ['tests/fixtures/projectile-injury-drill.js'], bundle: true,
    format: 'iife', platform: 'browser', write: false }).outputFiles[0].text;
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8')
    .replace('<head>', '<head><script src="/projectile-injury-drill.js"></script>');
fs.writeFileSync(path.join(root, 'dist/projectile-injury-drill.js'), script);
fs.writeFileSync(path.join(root, 'dist/projectile-injury.html'), html);
console.log('Local review: http://localhost:3001/projectile-injury.html — choose a shot, Launch, then Reset for a fresh encounter.');
