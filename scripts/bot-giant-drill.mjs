// Disposable local review page; a fresh build removes it from dist.
import fs from 'node:fs';
import {buildSync} from 'esbuild';
const helpers=buildSync({stdin:{contents:"export {creatureSize} from './server/game/creatureSize.ts'; export {arenaContains} from './server/game/arenaBoundary.ts'; export {INHALE} from './server/constants/gameConstants.ts';",resolveDir:process.cwd()},bundle:true,format:'iife',globalName:'GiantDrill',platform:'browser',write:false}).outputFiles[0].text;
fs.writeFileSync('dist/bot-giant-drill.js',helpers+'\n'+fs.readFileSync('tests/fixtures/bot-giant-drill.js','utf8'));
fs.writeFileSync('dist/bot-giant.html',fs.readFileSync('dist/index.html','utf8').replace('<head>','<head><script src="/bot-giant-drill.js"></script>'));
console.log('Local AI review: http://localhost:3001/bot-giant.html (development server only; fresh builds remove this page).');
