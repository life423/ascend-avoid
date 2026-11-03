// Disposable local review page, never imported by the game or included by a fresh release build.
import fs from 'node:fs';
import {buildSync} from 'esbuild';
const sizes=buildSync({stdin:{contents:"export {creatureSize} from './server/game/creatureSize.ts'",resolveDir:process.cwd()},bundle:true,format:'iife',globalName:'DefenseSizes',platform:'browser',write:false}).outputFiles[0].text;
fs.writeFileSync('dist/corner-defense-drill.js',sizes+'\n'+fs.readFileSync('tests/fixtures/corner-defense-drill.js','utf8'));
fs.writeFileSync('dist/corner-defense.html',fs.readFileSync('dist/index.html','utf8').replace('<head>','<head><script src="/corner-defense-drill.js"></script>'));
console.log('Local drill ready at http://localhost:3001/corner-defense.html (requires the local development server). A fresh build removes it.');
