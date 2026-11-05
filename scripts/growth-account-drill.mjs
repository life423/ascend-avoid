// Disposable localhost review page. A normal client build removes these files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = buildSync({ absWorkingDir: root, entryPoints: ['tests/fixtures/growth-account-drill.js'],
    bundle: true, format: 'iife', platform: 'browser', write: false }).outputFiles[0].text;
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8')
    .replace('<head>', '<head><script src="/growth-account-drill.js"></script>');
fs.writeFileSync(path.join(root, 'dist/growth-account-drill.js'), script);
fs.writeFileSync(path.join(root, 'dist/growth-account.html'), html);
console.log('Local review: http://localhost:3001/growth-account.html — controlled live gem transactions; normal upkeep and controls remain active.');
