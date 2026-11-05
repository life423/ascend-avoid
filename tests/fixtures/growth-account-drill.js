// Local setup and explicit controlled transactions, not a simulated weapon hit.
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    const options = { testBots: 0, testFieldGems: 0, testCores: 0, testCalm: true, testTurbines: 'manual' };
    const matches = value => String(value).includes('/matchmake/joinOrCreate/game_room');
    const body = value => JSON.stringify({ ...JSON.parse(value || '{}'), ...options });
    const fetch = window.fetch.bind(window);
    window.fetch = (url, init = {}) => {
        const address = typeof url === 'string' ? url : url.url;
        return matches(address) ? fetch(address.replace('/joinOrCreate/', '/create/'), { ...init, body: body(init.body) }) : fetch(url, init);
    };
    const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send, isolated = new WeakSet();
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (matches(url)) isolated.add(this); else isolated.delete(this);
        return open.call(this, method, isolated.has(this) ? String(url).replace('/joinOrCreate/', '/create/') : url, ...args);
    };
    XMLHttpRequest.prototype.send = function(value) { return send.call(this, isolated.has(this) ? body(value) : value); };
    localStorage.setItem('ascend.practice.v2', JSON.stringify({ version: 2, offered: true, lessons: {} }));
    localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off');

    window.addEventListener('load', () => {
        let stopped = false, busy = false, manager, room, referenceWidth = 0, frame;
        const records = [];
        const panel = document.createElement('aside'); panel.setAttribute('aria-label', 'Local growth accounting review');
        panel.style.cssText = 'position:fixed;z-index:99999;left:12px;bottom:max(164px,24vh);width:min(264px,calc(100vw - 24px));max-height:calc(100vh - max(164px,24vh) - 20px);overflow:auto;padding:10px;border:1px solid #487283;border-radius:10px;background:#071726ed;color:#defbff;font:12px/1.4 system-ui;box-sizing:border-box;touch-action:pan-y';
        panel.innerHTML = `<details open><summary style="cursor:pointer;font-weight:700">Local growth accounting</summary>
          <p style="margin:7px 0">Start at 2m gems. Lose 500k: the body should become about 1273 units wide, instead of staying at 1470.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <button data-action="reset" disabled>Reset 2m</button><button data-action="loss" disabled>Lose 500k</button>
            <button data-action="noop" disabled>No-op update</button><button data-action="gain" disabled>Receive 10k</button>
            <button data-action="land" disabled>Land cleanup</button><button data-action="center" disabled>Center</button>
          </div><output data-status aria-live="off" style="display:block;margin-top:8px">Connecting…</output>
          <p data-result aria-live="polite" style="margin:6px 0;color:#cce8f0"></p>
          <p style="margin:6px 0 0;color:#a8c6d0">Controlled transactions, not weapon attacks. Normal upkeep continues, so live totals drift. No-op and landing must not rebuild size; a real new receipt can grow it.</p>
          <p style="margin:6px 0 0;color:#a8c6d0">Dashed ring = size before the last debit. Move, inhale and puff normally. Collapse this panel for a clear view.</p>
        </details>`;
        for (const button of panel.querySelectorAll('button')) button.style.cssText = 'min-height:44px;padding:6px;border:1px solid #487283;border-radius:5px;background:#153c4b;color:#defbff;font:700 12px system-ui;cursor:pointer';
        document.body.append(panel);
        const status = panel.querySelector('[data-status]'), result = panel.querySelector('[data-result]');
        const buttons = [...panel.querySelectorAll('button')];
        const overlay = document.createElement('canvas'); overlay.setAttribute('aria-hidden', 'true');
        overlay.style.cssText = 'position:fixed;z-index:9000;pointer-events:none'; document.body.append(overlay);
        const read = () => {
            const p = manager?.getLocalPlayer();
            return p ? { gems: p.gems, width: p.width, state: p.state, flying: p.flying, time: manager.getState().time } : null;
        };
        window.growthAccountDrill = { ready: false, records, read };
        const wait = predicate => new Promise((resolve, reject) => {
            const until = Date.now() + 6000;
            const timer = setInterval(() => {
                if (stopped) { clearInterval(timer); reject(Error('Review closed.')); }
                else if (predicate()) { clearInterval(timer); resolve(); }
                else if (Date.now() > until) { clearInterval(timer); reject(Error('Controlled setup timed out. Reload to try again.')); }
            }, 25);
        });
        const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
        const center = () => {
            const p = manager.getLocalPlayer(), s = manager.getState();
            room.send('test:moveTo', { x: (s.worldWidth - p.width) / 2, y: (s.worldHeight - p.height) / 2 });
        };
        const perform = async action => {
            if (busy || stopped) return; busy = true; buttons.forEach(button => { button.disabled = true; });
            const before = read(); result.textContent = 'Applying controlled transaction…';
            try {
                if (action === 'reset') {
                    room.send('test:setGems', { count: 2000000 });
                    await wait(() => read().gems > 1995000 && read().width > 1465);
                    referenceWidth = 0; center();
                } else if (action === 'center') center();
                else if (action === 'land') room.send('test:land');
                else {
                    const delta = action === 'loss' ? -500000 : action === 'gain' ? 10000 : 0;
                    if (action === 'loss') referenceWidth = before.width;
                    room.send('test:changeGems', { delta });
                    if (delta < 0) await wait(() => read().gems <= Math.max(0, before.gems + delta) + 1000);
                    if (delta > 0) await wait(() => read().gems > before.gems + 8000);
                }
                // A no-op/land has no bank change to await. Observe several real state patches.
                await pause(160); const after = read();
                records.push({ action, before, after });
                result.textContent = action === 'reset' ? 'Reset complete — use Lose 500k to compare.' : action === 'center' ? 'Centered.'
                    : `${before.width.toFixed(1)} → ${after.width.toFixed(1)} wide · ${action === 'land' ? 'landing lifecycle cleanup' : action === 'noop' ? 'same live bank, no reset' : action === 'gain' ? '10k new gems received' : '500k gems debited'}`;
            } catch (error) { result.textContent = error.message; }
            finally {
                busy = false; buttons.forEach(button => { button.disabled = false; });
                document.querySelector('canvas.game-canvas')?.focus({ preventScroll: true });
            }
        };
        for (const button of buttons) button.onclick = () => { button.blur(); perform(button.dataset.action); };
        const ready = setInterval(async () => {
            const mode = window.game?.currentGameMode;
            if (!mode?.lastView || document.body.classList.contains('intro-playing') || !mode.multiplayerManager?.getLocalPlayer()) return;
            clearInterval(ready); manager = mode.multiplayerManager; room = manager.room;
            room.send('test:clearHoles'); room.send('test:endTurbines'); room.send('test:trafficHits', { on: false });
            await perform('reset'); window.growthAccountDrill.ready = true;
        }, 40);
        const refresh = setInterval(() => {
            if (stopped || !manager) return;
            const p = read(); if (p) status.textContent = `${p.gems.toLocaleString()} gems · ${p.width.toFixed(1)} wide · ${p.state}`;
        }, 100);
        const draw = () => {
            if (stopped) return;
            frame = requestAnimationFrame(draw);
            const canvas = document.querySelector('canvas.game-canvas'), mode = window.game?.currentGameMode, p = manager?.getLocalPlayer(), v = mode?.lastView;
            if (!canvas || !p || !v) return;
            const r = canvas.getBoundingClientRect();
            if (overlay.width !== canvas.width || overlay.height !== canvas.height) { overlay.width = canvas.width; overlay.height = canvas.height; }
            overlay.style.left = `${r.left}px`; overlay.style.top = `${r.top}px`; overlay.style.width = `${r.width}px`; overlay.style.height = `${r.height}px`;
            const ctx = overlay.getContext('2d'); ctx.clearRect(0, 0, overlay.width, overlay.height);
            if (!referenceWidth || p.state !== 'alive' || p.flying) return;
            const predicted = mode.predicted || p;
            const x = (predicted.x + p.width / 2 - v.x) * v.scale + canvas.width / 2;
            const y = (predicted.y + p.height / 2 - v.y) * v.scale + canvas.height / 2;
            ctx.strokeStyle = 'rgba(229, 244, 255, .6)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]);
            ctx.beginPath(); ctx.arc(x, y, referenceWidth * v.scale / 2, 0, Math.PI * 2); ctx.stroke();
        };
        frame = requestAnimationFrame(draw);
        window.addEventListener('pagehide', () => { stopped = true; clearInterval(ready); clearInterval(refresh); cancelAnimationFrame(frame); overlay.remove(); });
    });
}
