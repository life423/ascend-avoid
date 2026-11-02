/** Verify a compiled server; --runtime also checks the final container dependency boundary. */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootArg = process.argv.find(arg => arg.startsWith('--root='));
const root = rootArg ? resolve(rootArg.slice('--root='.length)) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'server', 'dist');
const files = [];
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) visit(path);
    else files.push(path);
  }
}
visit(dist);
assert.ok(existsSync(join(dist, 'index.js')), 'compiled server entry exists');
assert.equal(JSON.parse(readFileSync(join(dist, 'package.json'), 'utf8')).type, 'commonjs');
assert.ok(!existsSync(join(dist, 'tests')), 'production output excludes tests');
assert.ok(files.every(file => !/\.(?:map|d\.ts)$/.test(file)), 'production output excludes maps and declarations');
let dependencies = 0;
for (const file of files.filter(file => file.endsWith('.js'))) {
  const require = createRequire(file);
  for (const [, specifier] of readFileSync(file, 'utf8').matchAll(/\brequire\(["']([^"']+)["']\)/g)) {
    if (specifier.startsWith('node:') || builtinModules.includes(specifier)) continue;
    require.resolve(specifier);
    dependencies++;
  }
}
if (process.argv.includes('--runtime')) {
  assert.ok(!existsSync(join(root, 'node_modules')), 'container excludes client/build dependency tree');
  const require = createRequire(join(dist, 'index.js'));
  for (const dependency of ['typescript', 'vite', '@playwright/test', 'eslint']) {
    assert.throws(() => require.resolve(dependency), { code: 'MODULE_NOT_FOUND' }, `${dependency} stays outside the runtime image`);
  }
}
console.log(`Production package verified: ${files.length} files, ${dependencies} resolved imports, no compiled tests/maps/declarations.`);
