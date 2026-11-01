// Build first. Real weapon/movement updates, fixed inputs and deterministic reaction/network budgets.
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const load = file => import(pathToFileURL(resolve(__dirname, '../server/dist', file)).href);
(async () => {
  const { GameState } = await load('schema/GameState.js');
  const { spawnWeapon, updateWeapons } = await load('systems/weapons.js');
  const { weaponProfile, orbitalPosition } = await load('game/weaponKit.js');
  const { PINWHEEL, WEAPON_SHOTS } = await load('constants/gameConstants.js');
  const { BotBrain } = await load('game/bots.js');
  const NOW = 100000;
  function run(kind, gems, gap, reaction, latency, response, bot = false) {
    const s = new GameState(0); s.botFill = s.fieldGemTarget = 0; s.surgesOn = false; s.weaponsOn = true; s.setTurbines('off');
    const owner = s.addPlayer('owner', 'Owner', NOW), p = s.addPlayer('target', 'Target', NOW);
    owner.placeAt(100, 100); p.setGems(gems, 4200, 4200); p.isBot = bot; owner.dropProtection(); p.dropProtection();
    spawnWeapon(s, 1200, 2100, kind);
    const w = s.pinwheel, profile = weaponProfile(kind), warning = profile.orbit ? profile.shotMs - WEAPON_SHOTS.CHARGE_MS : 0;
    w.phase = 'active'; w.owner = owner.sessionId; w.at = 30000; w.originX = w.x; w.originY = w.y;
    w.activatedAt = 0; w.nextShotAt = profile.shotMs; w.nextAimAt = profile.orbit ? warning : 0;
    w.angle = kind === 'sentinel' ? 0 : -PINWHEEL.SPIN * (profile.orbit ? warning : profile.shotMs) / 1000;
    const launch = profile.orbit ? orbitalPosition(w.x, w.y, warning, 4200, 4200, kind) : w;
    p.placeAt(launch.x + 48 + gap, launch.y - p.height / 2);
    const width = p.width, random = Math.random; Math.random = () => .5;
    const brain = response === 'bot' ? new BotBrain() : null;
    let hits = 0, full = 0, grazes = 0;
    s.onEvent = (type, data) => { if (type === 'credit' && data.byId === owner.sessionId) { hits++; if (data.glancing) grazes++; else full++; } };
    try {
      for (let ms = 20; ms < profile.shotMs + profile.range / profile.speed * 1000 + 250; ms += 20) {
        s.time = ms; s.now = NOW + ms;
        if (brain && ms >= brain.nextThinkAt) {
          const move = brain.think(p, s, s.now), axes = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
          p.steer(...(axes[move] ?? [0,0]));
        } else if (!brain) p.steer(0, response === 'sidestep' && ms >= warning + reaction + latency ? -1 : 0);
        updateWeapons(s, .02, s.now);
        if (w.nextBolt > 0) w.nextShotAt = w.nextAimAt = Infinity; // isolate the first real shot
        p.updateMovement(4200, 4200, s.now, .02);
        if (p.state !== 'alive') break;
      }
    } finally { Math.random = random; }
    return { width: +width.toFixed(1), hits, full, grazes, lost: gems - p.gems, out: p.state !== 'alive' };
  }
  const rows = [];
  for (const kind of ['pinwheel','sentinel','ricochet']) for (const gems of [0,100,1000,5000]) for (const gap of [40,160,280,440,640])
    for (const reaction of [250,400,550]) for (const latency of [0,100,200]) for (const response of ['idle','sidestep']) {
      const human = run(kind,gems,gap,reaction,latency,response), bot = run(kind,gems,gap,reaction,latency,response,true);
      if (JSON.stringify(human) !== JSON.stringify(bot)) throw new Error('Bot/human physics mismatch');
      rows.push({kind,gap,reaction,latency,response,...human,parity:true});
    }
  const ai = [];
  for (const kind of ['pinwheel','sentinel','ricochet']) for (const gems of [0,100,1000,5000]) for (const gap of [280,440,640])
    ai.push({kind,gap,...run(kind,gems,gap,0,0,'bot',true)});
  const summarize = group => ({cases:group.length,hits:group.filter(r=>r.hits).length,full:group.filter(r=>r.full).length,grazes:group.filter(r=>r.grazes).length,knockouts:group.filter(r=>r.out).length});
  const summary = ['pinwheel','sentinel','ricochet'].map(kind => ({kind,idle:summarize(rows.filter(r=>r.kind===kind&&r.response==='idle')),sidestep:summarize(rows.filter(r=>r.kind===kind&&r.response==='sidestep')),bots:summarize(ai.filter(r=>r.kind===kind))}));
  const spacing = [200,300,500].map(distance => ({distance,oldGap:+(2*distance*Math.sin(PINWHEEL.SPIN*.140/2)-16).toFixed(1),newGap:+(2*distance*Math.sin(PINWHEEL.SPIN*PINWHEEL.SHOT_MS/2000)-16).toFixed(1)}));
  const result = {date:'2026-11-01',scope:'First-shot encounters; not a human fun/fairness guarantee. Width in world units, gap from muzzle to front shell, straight sidestep after stated reaction+latency. Bot sample includes normal imperfect brain decisions.',executions:rows.length*2+ai.length,summary,spacing,rows,ai};
  writeFileSync(resolve(__dirname,'../docs/playtests/projectile-counterplay-2026-11-01.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({executions:result.executions,summary,spacing},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
