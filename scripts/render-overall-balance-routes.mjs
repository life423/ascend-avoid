// Standalone research figure, not imported by the game. Generate route traces first.
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const input = process.argv[2] ?? '.tmp/giant-navigation-fixture-results.json';
const output = process.argv[3] ?? 'docs/playtests/overall-balance-routes-2026-11-04';
const data = JSON.parse(await fs.readFile(input, 'utf8'));
const fixture = data.fixture;
const scenario = { spec: fixture.body, l: { fans: fixture.fans, holes: fixture.blackHoles }, path: [fixture.body.startCenter, fixture.body.goalCenter] };
const bodyRadius = scenario.spec.width / 2;
const mapSize = 400, scale = mapSize / 4200, top = 74;
const round = number => Number(number.toFixed(2));
const start = scenario.path[0], goal = scenario.path.at(-1);
const point = (p, left) => ({ x: round(left + p.x * scale), y: round(top + p.y * scale) });
const circle = (p, radius, fill, stroke = 'none', extra = '') => `<circle cx="${p.x}" cy="${p.y}" r="${round(radius * scale)}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
function panel(left, after) {
  const clip = after ? 'after' : 'before';
  let svg = `<defs><clipPath id="${clip}"><rect x="${left}" y="${top}" width="${mapSize}" height="${mapSize}" rx="${700 * scale}"/></clipPath></defs>`;
  svg += `<text x="${left}" y="54" class="panel">${after ? 'After fan F1 powers down' : 'All three fans active'}</text>`;
  svg += `<rect x="${left}" y="${top}" width="${mapSize}" height="${mapSize}" rx="${700 * scale}" fill="#07121e" stroke="#426571"/>`;
  svg += `<g clip-path="url(#${clip})">`;
  for (const fan of scenario.l.fans) if (!after || fan.id !== 't1') svg += circle(point(fan, left), bodyRadius + 60, '#4fd1c529', '#4fd1c587');
  for (const hole of scenario.l.holes) if (hole.phase === 'active' || hole.phase === 'closing') svg += circle(point(hole, left), bodyRadius + hole.radius + 8, '#c3a5ff25', '#c3a5ff85');
  const inset = (bodyRadius + 8) * scale;
  svg += `<rect x="${left + inset}" y="${top + inset}" width="${mapSize - inset * 2}" height="${mapSize - inset * 2}" fill="none" stroke="#f5f9fc55" stroke-dasharray="4 5"/>`;
  const run = data.runs.find(r => r.mode === (after ? 'only-t1-ends' : 'all-static'));
  const track = [start, ...run.track];
  svg += `<polyline points="${track.map(p => { const v = point(p, left); return `${v.x},${v.y}`; }).join(' ')}" fill="none" stroke="${after ? '#62c9ff' : '#ff8c86'}" stroke-width="2.7" stroke-linejoin="round"/>`;
  for (const [i, fan] of scenario.l.fans.entries()) {
    const p = point(fan, left), inactive = after && fan.id === 't1';
    svg += circle(p, 60, inactive ? '#60717d' : '#80fff1', '#07121e', 'stroke-width="1.5"');
    svg += `<text x="${p.x + 10}" y="${p.y + 4}" class="mark">F${i + 1}${inactive ? ' off' : ''}</text>`;
  }
  for (const hole of scenario.l.holes) {
    const p = point(hole, left), active = hole.phase === 'active' || hole.phase === 'closing';
    svg += circle(p, hole.radius, active ? '#02030c' : 'none', active ? '#d6b8ff' : '#ffd166', `stroke-width="1.7" ${active ? '' : 'stroke-dasharray="3 2"'}`);
  }
  for (const [p, color, label] of [[start, '#80fff1', 'Start'], [goal, '#ffd166', 'Goal']]) {
    const v = point(p, left);
    svg += `<circle cx="${v.x}" cy="${v.y}" r="4.5" fill="${color}" stroke="#07121e" stroke-width="1.5"/><text x="${v.x + 9}" y="${v.y - 9}" class="mark" fill="${color}">${label}</text>`;
  }
  svg += '</g>';
  svg += `<text x="${left}" y="500" class="note">${after ? 'Arrives 11.0 seconds after F1 ends.' : 'Cannot cross while the full barrier remains.'}</text>`;
  return svg;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="590" viewBox="0 0 900 590">
<style>text{font-family:Arial,sans-serif;fill:#e8f4f8}.title{font-size:20px;font-weight:700}.panel{font-size:16px;font-weight:700}.mark{font-size:12px;paint-order:stroke;stroke:#07121e;stroke-width:3px;stroke-linejoin:round}.note{font-size:14px}.small{font-size:12px;fill:#afc5d1}</style>
<rect width="900" height="590" fill="#0a1724"/><text x="30" y="29" class="title">A maximum-size body can be temporarily boxed in by fans + holes</text>
${panel(30, false)}${panel(470, true)}
<text x="30" y="533" class="note">Shading shows where the center of a width-${scenario.spec.width} body cannot pass.</text>
<text x="30" y="555" class="small">Dots = physical fans · violet cores = live holes · gold hollow core = harmless warning</text>
<text x="30" y="575" class="small">Seed ${fixture.seed} at ${fixture.worldSeconds}s · actual server movement traces · fixed-hole comparison isolates fan F1's retirement</text>
</svg>`;
await fs.writeFile(`${output}.svg`, svg);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 590 }, deviceScaleFactor: 2 });
  await page.setContent(svg);
  await page.screenshot({ path: `${output}.png` });
} finally { await browser.close(); }
console.log(`Route figure: ${output}.png`);
