import { Client } from 'colyseus.js';
import { creatureSize } from '../../server/game/creatureSize';

// Setup uses existing guarded hooks. Every capture, launch, hit and injury is real.
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    const options = { testBots: 0, testFieldGems: 0, testCores: 0, testCalm: true, testTurbines: 'manual' };
    const endpoint = url => String(url).includes('/matchmake/joinOrCreate/game_room');
    const body = value => JSON.stringify({ ...JSON.parse(value || '{}'), ...options });
    const originalFetch = window.fetch.bind(window);
    window.fetch = (url, init = {}) => endpoint(typeof url === 'string' ? url : url.url)
        ? originalFetch(String(typeof url === 'string' ? url : url.url).replace('/joinOrCreate/', '/create/'), { ...init, body: body(init.body) })
        : originalFetch(url, init);
    const originalOpen = XMLHttpRequest.prototype.open, originalSend = XMLHttpRequest.prototype.send;
    const isolated = new WeakSet();
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (endpoint(url)) isolated.add(this); else isolated.delete(this);
        return originalOpen.call(this, method, isolated.has(this) ? String(url).replace('/joinOrCreate/', '/create/') : url, ...args);
    };
    XMLHttpRequest.prototype.send = function(value) { return originalSend.call(this, isolated.has(this) ? body(value) : value); };
    localStorage.setItem('ascend.practice.v2', JSON.stringify({ version: 2, offered: true, lessons: {} }));
    localStorage.setItem('ascend.guideSeen', 'true');
    localStorage.setItem('ascend.mouseFollow', 'off');

    window.addEventListener('load', () => {
        const scenarios = {
            'weak-cannon': { title: 'Small cannon → giant', target: 100000, source: 80, description: '80-wide shooter · 100k-gem target. Expect chip damage without injury.' },
            'weak-fan': { title: 'Small fan pilot → giant', target: 100000, source: 40, description: '40-wide pilot through a real fan · 100k-gem target. Expect chip damage without injury.' },
            peer: { title: 'Peer cannon → peer', target: null, source: 200, description: '200-wide rivals. Expect a meaningful hit and the normal seven-second injury.' },
        };
        const key = Object.hasOwn(scenarios, new URL(location.href).searchParams.get('scenario'))
            ? new URL(location.href).searchParams.get('scenario') : 'weak-cannon';
        const scenario = scenarios[key];
        const panel = document.createElement('aside');
        panel.setAttribute('aria-label', 'Local projectile injury review');
        panel.style.cssText = 'position:fixed;z-index:99999;left:12px;bottom:max(158px,25vh);width:min(250px,calc(100vw - 24px));padding:10px;border:1px solid #487283;border-radius:10px;background:#071726ed;color:#defbff;font:12px/1.4 system-ui;box-sizing:border-box;touch-action:pan-y';
        panel.innerHTML = `<details open><summary style="cursor:pointer;font-weight:700">Local projectile injury review</summary>
          <p style="margin:8px 0"><select aria-label="Shot scenario" style="width:100%;font:inherit;padding:5px;color:#defbff;background:#102a39;border:1px solid #487283;border-radius:5px">${Object.entries(scenarios).map(([value, s]) => `<option value="${value}"${value === key ? ' selected' : ''}>${s.title}</option>`).join('')}</select></p>
          <p data-description style="margin:8px 0"></p><p style="margin:8px 0;display:flex;gap:7px"><button data-launch disabled>Launch</button><button data-reset>Reset</button></p>
          <output aria-live="polite" style="display:block">Connecting…</output>
          <p style="margin:7px 0 0;color:#a8c6d0">You are the target. Move, inhale and puff normally. One shot per reset; collapse for a clear view.</p></details>`;
        for (const button of panel.querySelectorAll('button')) button.style.cssText = 'font:700 12px system-ui;padding:7px 11px;border:1px solid #487283;border-radius:5px;background:#153c4b;color:#defbff;cursor:pointer';
        panel.querySelector('[data-description]').textContent = scenario.description;
        document.body.append(panel);
        const launch = panel.querySelector('[data-launch]'), status = panel.querySelector('output');
        const helpers = new Set(); let stopped = false, busy = false, room, manager, shotId = '', impact = null;
        const closeHelpers = () => { for (const helper of helpers) { helpers.delete(helper); helper.leave().catch(() => {}); } };
        const reset = value => {
            stopped = true; closeHelpers(); const url = new URL(location.href); url.searchParams.set('scenario', value); location.replace(url);
        };
        panel.querySelector('select').onchange = event => reset(event.target.value);
        panel.querySelector('[data-reset]').onclick = () => reset(key);
        window.addEventListener('pagehide', () => { stopped = true; closeHelpers(); });
        const wait = predicate => new Promise((resolve, reject) => {
            const until = Date.now() + 9000, timer = setInterval(() => {
                if (stopped) { clearInterval(timer); reject(Error('Review closed.')); }
                else if (predicate()) { clearInterval(timer); resolve(); }
                else if (Date.now() > until) { clearInterval(timer); reject(Error('Setup timed out. Reset to try again.')); }
            }, 30);
        });
        const stock = width => {
            const state = manager.getState(); let lo = 0, hi = 1000000;
            while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (creatureSize(mid, state.worldWidth, state.worldHeight) < width) lo = mid + 1; else hi = mid; }
            return lo;
        };
        const player = helper => helper.state.players.get(helper.sessionId);
        const move = (helper, x, y) => {
            const p = helper === room ? manager.getLocalPlayer() : player(helper);
            helper.send('test:moveTo', { x: x - p.width / 2, y: y - p.height / 2 });
        };
        const join = async name => {
            const helper = await new Client(location.origin.replace(/^http/, 'ws')).joinById(room.id, { name });
            helper.onMessage('*', () => {});
            if (stopped) { await helper.leave(); throw Error('Review closed.'); }
            helpers.add(helper); await wait(() => !!player(helper)); return helper;
        };
        const configure = async (helper, gems, x, y) => {
            helper.send('test:setGems', { count: gems }); await wait(() => player(helper).gems >= gems * .995 - 1 && player(helper).gems <= gems + 1);
            move(helper, x, y); helper.send('test:protect', { ms: 0 }); helper.send('test:face', { angle: 0 });
            await wait(() => Math.hypot(player(helper).x + player(helper).width / 2 - x, player(helper).y + player(helper).height / 2 - y) < 3 && !player(helper).spawnProtected);
        };
        launch.onclick = async () => {
            if (busy || stopped) return; busy = true; launch.disabled = true; launch.blur(); status.textContent = 'Preparing a real shot…';
            try {
                if (key === 'weak-fan') {
                    const pilot = await join('Fan review pilot'); shotId = pilot.sessionId;
                    const gems = stock(40);
                    await configure(pilot, gems, 900 - 60 - creatureSize(gems) / 2 - 4, 2100);
                    room.send('test:placeTurbine', { x: 900, y: 2100, intake: Math.PI, still: true });
                    await wait(() => player(pilot)?.flying); status.textContent = 'Fan launch in flight — you can move.';
                } else {
                    const shooter = await join('Cannon review shooter'), ammo = await join('Cannon review captive'); shotId = ammo.sessionId;
                    await configure(shooter, stock(scenario.source), 900, 2100);
                    await configure(ammo, stock(40), 900 + (player(shooter).width + 40) / 2 + 1, 2100);
                    shooter.send('inhale'); await wait(() => player(ammo)?.capturedBy === shooter.sessionId);
                    shooter.send('exhale'); await wait(() => !player(shooter).inhaling);
                    shooter.send('tap'); await wait(() => player(ammo)?.flying); status.textContent = 'Player shot in flight — you can move.';
                }
                await wait(() => !!impact || !room.state.players.get(shotId)?.flying);
                if (!impact) status.textContent = 'The shot missed. Reset for another encounter.';
                closeHelpers();
            } catch (error) {
                if (!stopped) { status.textContent = error.message; closeHelpers(); }
            }
        };
        const ready = setInterval(async () => {
            const mode = window.game?.currentGameMode;
            if (!mode?.lastView || mode.introPlaying || !mode.multiplayerManager?.getLocalPlayer()) return;
            clearInterval(ready); manager = mode.multiplayerManager; room = manager.room;
            try {
                status.textContent = 'Preparing your target…';
                room.onMessage('impact', event => {
                    if (event.targetId === manager.localSessionId && event.projectileId === shotId) impact = { loss: event.gems, out: event.out };
                });
                room.send('test:clearHoles'); room.send('test:endTurbines'); room.send('test:trafficHits', { on: false });
                const gems = scenario.target ?? stock(200); room.send('test:setGems', { count: gems });
                await wait(() => manager.getLocalPlayer().gems >= gems * .995 - 1 && manager.getLocalPlayer().gems <= gems + 1);
                move(room, 2400, 2100); room.send('test:protect', { ms: 0 });
                await wait(() => { const p = manager.getLocalPlayer(); return Math.abs(p.x + p.width / 2 - 2400) < 3 && !p.spawnProtected && room.state.blackHoles.length === 0; });
                launch.disabled = false; status.textContent = 'Ready — Launch when you want to test the impact.';
                const updates = setInterval(() => {
                    if (stopped) { clearInterval(updates); return; }
                    if (!impact) return;
                    const p = manager.getLocalPlayer(), state = manager.getState(), remaining = Math.max(0, p.injuredUntil - state.time);
                    status.textContent = `${impact.out ? 'Knocked out' : `Impact: −${impact.loss.toLocaleString()} gems`} · ${remaining > 0 ? `INJURED ${(remaining / 1000).toFixed(1)}s` : 'healthy'} · ${p.width} wide`;
                }, 100);
            } catch (error) { if (!stopped) status.textContent = error.message; }
        }, 50);
    });
}
