// Native Safari via SafariDriver or XCUITest: no Playwright browser/autoplay bypass.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

const appiumMode = process.env.SAFARI_DRIVER_MODE === 'appium';
const driver = (process.env.SAFARI_DRIVER_URL || (appiumMode ? 'http://127.0.0.1:4723' : 'http://127.0.0.1:4444')).replace(/\/$/, '');
const arena = process.env.E2E_URL || 'https://ascendavoid.com/';
const output = process.env.SAFARI_RESULTS || 'test-results/safari-music';
const deviceUDID = process.env.SAFARI_DEVICE_UDID;
const deviceType = process.env.SAFARI_DEVICE_TYPE;
const simulator = !!deviceUDID;
const runFile = promisify(execFile);
const ELEMENT = 'element-6066-11e4-a52e-4f735466cecf';
const musicSelector = '.drawer[aria-hidden="false"] [data-action="music"]';
const effectsSelector = '.drawer[aria-hidden="false"] [data-action="sound"]';
const report = {
    target: arena, startedAt: new Date().toISOString(), checkpoints: [],
    testHost: simulator ? { kind: 'Apple Simulator', deviceType, deviceUDID, automation: appiumMode ? 'XCUITest native taps' : 'SafariDriver' } : { kind: 'macOS Safari' },
};
let sessionPath, stage = 'native Safari session';
await mkdir(output, { recursive: true });

async function command(path, method = 'GET', body, timeout = 15000) {
    const response = await fetch(driver + path, {
        method, signal: AbortSignal.timeout(timeout),
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const { value } = await response.json();
    assert(response.ok && !value?.error, method + ' ' + path + ': ' + (value?.message || response.status));
    return value;
}
const execute = (fn, ...args) => command(sessionPath + '/execute/sync', 'POST', { script: 'return (' + fn + ').apply(null, arguments);', args });
async function openSession(alwaysMatch) {
    const discoveryDeadline = Date.now() + 30000;
    for (;;) {
        try { return await command('/session', 'POST', { capabilities: { alwaysMatch } }, appiumMode ? 300000 : 90000); }
        catch (error) {
            // CoreSimulator can be booted before Safari's native inspector host
            // is discoverable. Retry this attachment race, never app assertions.
            if (appiumMode || !simulator || !String(error).includes('Could not find any session hosts') || Date.now() >= discoveryDeadline) throw error;
            console.warn('Waiting for the requested native simulator Safari host to become discoverable.');
            await delay(1000);
        }
    }
}
async function wait(description, sample, matches, timeout = 15000) {
    let latest;
    const deadline = Date.now() + timeout;
    do {
        latest = await sample();
        if (matches(latest)) return latest;
        await delay(100);
    } while (Date.now() < deadline);
    assert.fail(description + ': ' + JSON.stringify(latest));
}
async function dismissKnownSafariOnboarding() {
    if (!appiumMode) return;
    const title = 'View Bookmarks, Share Menu, and Open Tabs';
    const originalContext = await command(sessionPath + '/context');
    assert(typeof originalContext === 'string' && originalContext !== 'NATIVE_APP', 'Safari has an active web context');
    await command(sessionPath + '/context', 'POST', { name: 'NATIVE_APP' });
    try {
        const source = await command(sessionPath + '/source');
        await writeFile(join(output, 'safari-native-startup.xml'), source);
        if (!source.replace(/\s+/g, ' ').includes(title)) return;
        await writeFile(join(output, 'safari-onboarding.xml'), source);
        const candidates = await command(sessionPath + '/elements', 'POST', { using: 'accessibility id', value: 'Close' });
        const visible = [];
        for (const candidate of candidates) {
            const id = candidate[ELEMENT] || candidate.ELEMENT;
            if (id && await command(sessionPath + '/element/' + id + '/displayed')) visible.push(id);
        }
        assert.equal(visible.length, 1, 'known Safari onboarding has one visible Close button');
        // This is only the named Safari guidance popover. No generic system or
        // permission alert is accepted, and the tap remains native through WDA.
        await command(sessionPath + '/element/' + visible[0] + '/click', 'POST', {});
        await wait('known Safari onboarding closes', async () =>
            (await command(sessionPath + '/source')).replace(/\s+/g, ' ').includes(title), value => !value, 5000);
        report.onboardingDismissed = { title, nativeTap: true };
    } finally {
        await command(sessionPath + '/context', 'POST', { name: originalContext });
    }
}
async function click(selector) {
    if (simulator) await execute(s => {
        const target = [...document.querySelectorAll(s)].find(e => {
            const r = e.getBoundingClientRect(), style = getComputedStyle(e);
            return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && !e.closest('[inert]');
        });
        target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, selector);
    const element = await wait('reachable native click: ' + selector, () => execute(s => [...document.querySelectorAll(s)].find(e => {
        const r = e.getBoundingClientRect(), style = getComputedStyle(e);
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        return r.width > 0 && r.height > 0 && x >= 0 && x < innerWidth && y >= 0 && y < innerHeight &&
            style.visibility !== 'hidden' && style.display !== 'none' && !e.closest('[inert]') &&
            e.contains(document.elementFromPoint(x, y));
    }) || null, selector), value => !!value?.[ELEMENT]);
    await command(sessionPath + '/element/' + element[ELEMENT] + '/click', 'POST', {});
}
async function screenshot(name) {
    const path = join(output, name + '.png');
    if (simulator) {
        await runFile('xcrun', ['simctl', 'io', deviceUDID, 'screenshot', '--type=png', path], { timeout: 15000 });
    } else {
        await writeFile(path, Buffer.from(await command(sessionPath + '/screenshot'), 'base64'));
    }
}
const snapshot = () => execute(() => window.__musicProbe?.read() || null);
const text = selector => execute(s => document.querySelector(s)?.textContent.trim() || null, selector);
const level = (value, index) => index === undefined ? Math.max(0, ...value.contexts.map(c => c.rms)) : value.contexts[index]?.rms || 0;
const audible = index => wait('native music audio output', snapshot, value => value && level(value, index) > .00002);
const silent = index => wait('muted native audio output', snapshot, value => value && level(value, index) < .000001);
async function checkpoint(name, extra = {}) {
    stage = name;
    report.checkpoints.push({ name, at: new Date().toISOString(), audio: await snapshot(), ...extra });
    await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
}

function installProbe() {
    if (window.__musicProbe) return;
    const NativeContext = window.AudioContext;
    if (typeof NativeContext !== 'function') throw new Error('Native Safari Web Audio is unavailable');
    const originalConnect = AudioNode.prototype.connect, contexts = [], intervals = new Set(), events = [], errors = [];
    const originalSetInterval = window.setInterval.bind(window), originalClearInterval = window.clearInterval.bind(window);
    window.setInterval = (...args) => { const id = originalSetInterval(...args); intervals.add(id); return id; };
    window.clearInterval = id => { intervals.delete(id); originalClearInterval(id); };
    const states = () => contexts.map(r => ({ state: r.context.state, currentTime: r.context.currentTime }));
    window.addEventListener('error', event => errors.push(String(event.message)));
    window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
    document.addEventListener('visibilitychange', () => events.push({ type: 'visibility', hidden: document.hidden, at: performance.now(), contexts: states() }));
    class ProbedContext extends NativeContext {
        constructor(options) {
            super(options);
            const analyser = this.createAnalyser(), sink = this.createGain();
            analyser.fftSize = 2048; sink.gain.value = 0;
            originalConnect.call(analyser, sink); originalConnect.call(sink, this.destination);
            const record = { context: this, analyser, sink, samples: new Float32Array(2048), rms: 0, maxPeak: 0, routes: 0 };
            contexts.push(record);
            this.addEventListener('statechange', () => events.push({ type: 'context', index: contexts.indexOf(record), hidden: document.hidden, at: performance.now(), contexts: states() }));
        }
    }
    window.AudioContext = ProbedContext;
    AudioNode.prototype.connect = function(destination, ...args) {
        const result = originalConnect.call(this, destination, ...args);
        const record = contexts.find(r => r.context === this.context);
        if (record && destination === record.context.destination && this !== record.sink) {
            originalConnect.call(this, record.analyser, args[0] || 0, 0);
            record.routes++;
        }
        return result;
    };
    const measure = () => {
        for (const r of contexts) {
            r.rms = 0;
            if (r.context.state !== 'running') continue;
            r.analyser.getFloatTimeDomainData(r.samples);
            let energy = 0;
            for (const sample of r.samples) { energy += sample * sample; r.maxPeak = Math.max(r.maxPeak, Math.abs(sample)); }
            r.rms = Math.sqrt(energy / r.samples.length);
        }
    };
    const frame = () => { measure(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    window.__musicProbe = {
        read() { measure(); return { hidden: document.hidden, contexts: contexts.map(r => ({ state: r.context.state, currentTime: r.context.currentTime, rms: r.rms, maxPeak: r.maxPeak, routes: r.routes })), intervals: intervals.size, events: events.slice(-80), errors: [...errors] }; },
        resetPeaks() { for (const r of contexts) r.maxPeak = 0; },
    };
}
async function entry() {
    await wait('ordinary join screen', () => execute(() => !!document.querySelector('.join-dialog[open] .join-play')), Boolean);
    await execute(installProbe);
}
async function play() {
    await click('.join-dialog[open] .join-play');
    await wait('ordinary live player', () => execute(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer() && !document.body.classList.contains('intro-playing')), Boolean);
}
async function openMenu() {
    if (!await execute(() => !!document.querySelector('.drawer[aria-hidden="false"]'))) await click('.hamburger-button, .bar-help');
    await wait('visible game menu', () => text(musicSelector), value => value === 'Music off' || value === 'Music on');
}
async function clockAdvances(index) {
    const before = await snapshot();
    await wait('native audio clock advances', snapshot, value => value.contexts[index].currentTime > before.contexts[index].currentTime + .15);
}
async function backgroundReturned(cycle, label) {
    // Safari can defer script evaluation while hidden. The native visibility
    // history and clock are checked only after the browser returns to the front.
    const returned = await wait('real ' + label + ' visibility transitions', snapshot, value =>
        value?.events.filter(e => e.type === 'visibility' && e.hidden).length >= cycle + 1 &&
        value.events.filter(e => e.type === 'visibility' && !e.hidden).length >= cycle + 1);
    const hidden = returned.events.filter(e => e.type === 'visibility' && e.hidden).at(-1);
    const visible = returned.events.filter(e => e.type === 'visibility' && !e.hidden).at(-1);
    assert(visible.at - hidden.at >= 1200, 'game was genuinely backgrounded');
    assert(visible.contexts[0].currentTime - hidden.contexts[0].currentTime < .8, 'music clock pauses while hidden');
    await audible(0); await clockAdvances(0);
    await checkpoint('real-' + label + '-return-' + (cycle + 1));
}

try {
    assert(['native', 'appium'].includes(process.env.SAFARI_DRIVER_MODE || 'native'), 'known Safari driver mode');
    if (appiumMode) assert(simulator, 'XCUITest mode requires an explicit Apple Simulator UDID');
    if (simulator) assert(['iPhone', 'iPad'].includes(deviceType), 'SAFARI_DEVICE_TYPE must identify iPhone or iPad');
    await wait('native Safari driver ready', () => command('/status').catch(() => null), value => value?.ready === true, 30000);
    const alwaysMatch = appiumMode ? {
        platformName: 'ios', browserName: 'Safari',
        'appium:automationName': 'XCUITest', 'appium:udid': deviceUDID,
        'appium:nativeWebTap': true, 'appium:nativeWebTapStrict': true,
        'appium:safariInitialUrl': arena, 'appium:showXcodeLog': true,
        'appium:webviewConnectTimeout': 20000, 'appium:wdaLaunchTimeout': 120000,
        'appium:waitForIdleTimeout': 1,
    } : {
        browserName: 'safari',
        ...(simulator ? {
            platformName: 'ios', 'safari:useSimulator': true,
            'safari:deviceUDID': deviceUDID, 'safari:deviceType': deviceType,
        } : {}),
    };
    const session = await openSession(alwaysMatch);
    assert(session.sessionId, 'safaridriver created a session');
    sessionPath = '/session/' + session.sessionId;
    report.capabilities = session.capabilities;
    assert.equal(session.capabilities.browserName.toLowerCase(), 'safari', 'native Safari capability');
    if (simulator) {
        assert.equal(session.capabilities.platformName.toLowerCase(), 'ios', 'actual iOS/iPadOS Safari platform');
        if (appiumMode) {
            const automationName = session.capabilities.automationName || session.capabilities['appium:automationName'];
            const actualUDID = session.capabilities.udid || session.capabilities['appium:udid'];
            assert.equal(String(automationName).toLowerCase(), 'xcuitest', 'actual native XCUITest session');
            assert.equal(String(actualUDID).toLowerCase(), deviceUDID.toLowerCase(), 'actual selected simulator UDID');
        } else {
            assert.equal(session.capabilities['safari:useSimulator'], true, 'actual Apple Simulator session');
            if (session.capabilities['safari:deviceUDID']) assert.equal(session.capabilities['safari:deviceUDID'], deviceUDID, 'requested native simulator');
            if (session.capabilities['safari:deviceType']) assert.equal(session.capabilities['safari:deviceType'], deviceType, 'requested native device type');
        }
    }
    await command(sessionPath + '/timeouts', 'POST', { implicit: 0, pageLoad: 60000, script: 15000 });
    await dismissKnownSafariOnboarding();
    // Native iOS Safari does not implement desktop window resizing.
    if (!simulator) await command(sessionPath + '/window/rect', 'POST', { width: 1280, height: 900 });
    await command(sessionPath + '/url', 'POST', { url: 'about:blank' });
    report.userAgent = await execute(() => navigator.userAgent);
    assert.match(report.userAgent, /AppleWebKit\/.*Version\/.*Safari\//, 'actual Safari user agent');
    assert.doesNotMatch(report.userAgent, /Chrome|Chromium|Firefox/);
    report.device = await execute(() => ({
        touchPoints: navigator.maxTouchPoints, width: innerWidth, height: innerHeight,
        screen: { width: screen.width, height: screen.height }, pixelRatio: devicePixelRatio,
    }));
    // iPad's desktop browsing mode may expose the same UA as macOS Safari.
    if (simulator) assert(report.device.touchPoints > 0, 'native touch-capable iPhone/iPad session');

    stage = 'isolated native audio backend preflight';
    await execute(() => {
        document.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1">';
        document.body.innerHTML = '<button id="native-audio" style="width:240px;height:64px">Test native audio backend</button>';
        const record = window.__nativeAudio = { context: null, oscillator: null, analyser: null, samples: null, tap: null, errors: [], resumeError: null };
        record.read = () => {
            if (record.analyser && record.samples) record.analyser.getFloatTimeDomainData(record.samples);
            return {
                tap: record.tap, errors: [...record.errors], resumeError: record.resumeError,
                state: record.context?.state || null, currentTime: record.context?.currentTime || 0,
                peak: record.samples ? Math.max(...record.samples.map(Math.abs)) : 0,
                viewport: { width: innerWidth, height: innerHeight, scale: visualViewport?.scale || 1 },
            };
        };
        document.querySelector('button').addEventListener('click', event => {
            // Record delivery before any audio API call so a missed/blocked tap
            // and an AudioContext setup error have distinct failure evidence.
            record.tap = { trusted: event.isTrusted, activation: navigator.userActivation?.isActive ?? null };
            try {
                const context = record.context = new AudioContext();
                const oscillator = record.oscillator = context.createOscillator();
                const analyser = record.analyser = context.createAnalyser(), gain = context.createGain();
                record.samples = new Float32Array(analyser.fftSize);
                gain.gain.value = 0; oscillator.connect(analyser); analyser.connect(gain); gain.connect(context.destination); oscillator.start();
                void context.resume().catch(error => { record.resumeError = String(error); });
            } catch (error) { record.errors.push(String(error)); }
        });
    });
    await dismissKnownSafariOnboarding();
    await click('#native-audio');
    report.nativeBackend = await wait(stage, () => execute(() => window.__nativeAudio?.read() || null),
        value => value?.tap?.trusted === true && value.state === 'running' && value.currentTime > .15 && value.peak > .1);
    await execute(() => { window.__nativeAudio.oscillator.stop(); void window.__nativeAudio.context.close(); });

    stage = 'fresh music preference';
    await command(sessionPath + '/url', 'POST', { url: arena }, 70000);
    await wait('app document loaded', () => execute(() => !!document.querySelector('.join-dialog')), Boolean);
    await execute(() => {
        localStorage.removeItem('ascend.music'); localStorage.setItem('ascend.muted', 'true');
        localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off');
    });
    await command(sessionPath + '/refresh', 'POST', {}, 70000);
    await entry(); await play(); await openMenu();
    assert.equal(await text(musicSelector), 'Music off');
    assert.equal((await snapshot()).contexts.length, 0, 'no music context before opt-in');
    const bounds = await execute(s => {
        const e = document.querySelector(s), r = e.getBoundingClientRect();
        return { width: r.width, height: r.height, top: r.top, bottom: r.bottom, viewport: innerHeight, pressed: e.getAttribute('aria-pressed') };
    }, musicSelector);
    assert(bounds.width >= 44 && bounds.height >= 44 && bounds.top >= 0 && bounds.bottom <= bounds.viewport, 'visible 44px Music control');
    assert.equal(bounds.pressed, 'false');
    await checkpoint('muted-by-default', { bounds });

    stage = 'trusted opt-in and mute';
    await click(musicSelector); await audible(0); await clockAdvances(0);
    assert.equal(await text(musicSelector), 'Music on');
    assert.equal(await execute(() => localStorage.getItem('ascend.music')), 'true');
    assert.equal((await snapshot()).contexts[0].routes, 1, 'passive probe preserves one destination route');
    await screenshot('music-on'); await checkpoint('trusted-opt-in-audio');
    await click(musicSelector); await silent();
    assert.equal(await text(musicSelector), 'Music off');
    await checkpoint('muted-silence');

    stage = 'remembered opt-in waits for ordinary Play';
    await click(musicSelector); await audible(0);
    await command(sessionPath + '/refresh', 'POST', {}, 70000);
    await entry(); await delay(750);
    assert.equal(await execute(() => localStorage.getItem('ascend.music')), 'true');
    assert.equal((await snapshot()).contexts.length, 0, 'stored opt-in alone does not autoplay');
    await play(); await audible(0); await openMenu(); await checkpoint('remembered-choice-after-Play');

    stage = 'independent effects and music';
    assert.equal(await text(effectsSelector), 'Effects off');
    await click(effectsSelector);
    await wait('real effects confirmation output', snapshot, value => value.contexts[1]?.maxPeak > .00002);
    await audible(0);
    await click(effectsSelector); await audible(0);
    await click(musicSelector); await silent();
    await execute(() => window.__musicProbe.resetPeaks());
    await click(effectsSelector);
    await wait('effects output while music is muted', snapshot, value => value.contexts[1]?.maxPeak > .00002);
    await silent(0); await click(effectsSelector);
    await checkpoint('independent-effects');

    stage = 'rapid toggles keep one music context';
    const baselineIntervals = (await snapshot()).intervals;
    await click(musicSelector); await audible(0);
    for (let i = 0; i < 6; i++) { await click(musicSelector); await click(musicSelector); }
    await audible(0);
    const rapid = await snapshot();
    assert.equal(rapid.contexts.length, 2, 'one music context plus the independent effects context');
    assert.equal(rapid.contexts.filter(c => c.state === 'running').length, 1);
    assert(rapid.intervals <= baselineIntervals + 1, 'rapid toggles do not stack music schedulers');
    await checkpoint('rapid-toggles');

    if (simulator) {
        stage = 'real iOS app background and foreground';
        report.appNavigation = { away: 'com.apple.Preferences', back: 'com.apple.mobilesafari', cycles: 3 };
        for (let cycle = 0; cycle < 3; cycle++) {
            await runFile('xcrun', ['simctl', 'launch', deviceUDID, 'com.apple.Preferences'], { timeout: 30000 });
            await delay(3000);
            await runFile('xcrun', ['simctl', 'launch', deviceUDID, 'com.apple.mobilesafari'], { timeout: 30000 });
            await backgroundReturned(cycle, 'app');
        }
    } else {
        stage = 'real Safari window background and foreground';
        const rect = await command(sessionPath + '/window/rect');
        // Native minimization guarantees an actual hidden window. Merely
        // switching SafariDriver command targets does not establish OS focus.
        report.windowNavigation = { strategy: 'native minimize/restore', rect, cycles: 3 };
        for (let cycle = 0; cycle < 3; cycle++) {
            await command(sessionPath + '/window/minimize', 'POST', {});
            await delay(3000);
            await command(sessionPath + '/window/rect', 'POST', rect);
            await backgroundReturned(cycle, 'window');
        }
    }

    stage = 'tutorial music control';
    await openMenu(); await click('.drawer[aria-hidden="false"] .practice-open');
    await click('[data-lesson="basics"]');
    await wait('ordinary private basics lesson', () => execute(() => window.game?.currentGameMode?.multiplayerManager?.getState()?.practice?.lesson), value => value === 'basics');
    const tutorialMusic = '.practice-actions [data-do="music"]';
    assert.equal(await text(tutorialMusic), 'Music on');
    await click(tutorialMusic); await silent(); await screenshot('tutorial-music-off');
    await click(tutorialMusic); await audible(0);
    await click('.practice-actions [data-do="exit"]');
    await wait('ordinary tutorial exit', () => execute(() => window.game?.currentGameMode?.multiplayerManager?.getState()?.practice?.enabled), value => value === false);
    await openMenu(); assert.equal(await text(musicSelector), 'Music on');
    await click(musicSelector); await silent(); await screenshot('final-music-off');
    await checkpoint('tutorial-and-menu-synchronized');

    report.assets = await execute(() => [...document.scripts].map(s => s.src).filter(s => /\/assets\/main-/.test(s)));
    assert.deepEqual((await snapshot()).errors, [], 'no page errors or unhandled audio rejections');
    report.passed = true;
    report.finishedAt = new Date().toISOString();
    await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
} catch (error) {
    report.passed = false; report.failedStage = stage; report.error = String(error.stack || error);
    if (sessionPath) {
        report.failure = await execute(() => ({
            url: location.href, userAgent: navigator.userAgent, hidden: document.hidden,
            visibilityState: document.visibilityState, focused: document.hasFocus(),
            audio: window.__musicProbe?.read() || null,
            nativeBackend: window.__nativeAudio?.read() || null,
            visibleDialogs: [...document.querySelectorAll('[role="dialog"], dialog[open]')].map(e => e.textContent.slice(0, 800)),
        })).catch(value => ({ diagnosticError: String(value) }));
        await screenshot('failure').catch(() => {});
    }
    await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
} finally {
    if (sessionPath) await command(sessionPath, 'DELETE').catch(error => { console.error(String(error)); process.exitCode = 1; });
}
