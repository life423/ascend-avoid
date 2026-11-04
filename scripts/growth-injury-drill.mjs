// Disposable local review page. Build first; fresh production builds remove it.
import fs from 'node:fs';
import {buildSync} from 'esbuild';
const script=buildSync({entryPoints:['tests/fixtures/growth-injury-drill.js'],bundle:true,format:'iife',platform:'browser',write:false}).outputFiles[0].text;
fs.writeFileSync('dist/growth-injury-drill.js',script);
const html=fs.readFileSync('dist/index.html','utf8').replace('<head>','<head><script src="/growth-injury-drill.js"></script>');
fs.writeFileSync('dist/growth-review.html',html);
// Keep the user's existing local review URL useful after rebuilding.
fs.writeFileSync('dist/rounded-corners.html',html);
console.log('Local review: http://localhost:3001/growth-review.html — normal game rules with guarded setup controls.');
