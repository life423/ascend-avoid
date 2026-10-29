import { buildSync } from 'esbuild';
import { execFileSync } from 'node:child_process';
const result = buildSync({ entryPoints: ['scripts/practice-progress.unit.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
execFileSync(process.execPath, ['-e', result.outputFiles[0].text], { stdio: 'inherit' });
