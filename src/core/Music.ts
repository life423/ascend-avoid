export const MUSIC_EVENT = 'ascend:music';
const STORAGE_KEY = 'ascend.music';
const BAR_SECONDS = 8;
const FADE_SECONDS = .18;
const VOLUME = .46;

/** An original, slow 64-second ambient phrase; MIDI notes keep the score readable. */
const SCORE = [
    { chord: [50, 57, 60, 64], bass: 38, melody: [69, 72] },
    { chord: [46, 53, 57, 60], bass: 34, melody: [65, 69] },
    { chord: [48, 53, 57, 64], bass: 41, melody: [67, 64] },
    { chord: [48, 55, 58, 62], bass: 36, melody: [62, 67] },
    { chord: [43, 50, 57, 58], bass: 43, melody: [69, 70] },
    { chord: [46, 53, 60, 65], bass: 34, melody: [72, 65] },
    { chord: [50, 57, 60, 64], bass: 38, melody: [64, 69] },
    { chord: [48, 55, 62, 64], bass: 36, melody: [67, 62] },
] as const;

type Voice = { stop(at: number): void; dispose(): void };
type Timbre = 'pad' | 'bell' | 'pulse';

/** Music owns its audio bus, so muting effects never changes the music choice. */
class Music {
    enabled = false;
    private context: AudioContext | null = null;
    private master: GainNode | null = null;
    private filter: BiquadFilterNode | null = null;
    private voices = new Set<Voice>();
    private scheduler: ReturnType<typeof setInterval> | null = null;
    private suspendTimer: ReturnType<typeof setTimeout> | null = null;
    private suspending = false;
    private generation = 0;
    private unlocked = false;
    private pageAway = false;
    private nextBar = 0;
    private barIndex = 0;

    constructor() {
        try { this.enabled = localStorage.getItem(STORAGE_KEY) === 'true'; } catch { /* Optional storage defaults off. */ }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.pause();
            else if (this.canPlay()) this.unlock();
        });
        window.addEventListener('pagehide', () => { this.pageAway = true; this.pause(); });
        window.addEventListener('pageshow', () => {
            this.pageAway = false;
            if (this.canPlay()) this.unlock();
        });
    }

    toggle(): void {
        this.enabled = !this.enabled;
        try { localStorage.setItem(STORAGE_KEY, String(this.enabled)); } catch { /* The current-page choice still works. */ }
        if (this.enabled) this.unlock();
        else this.pause();
        window.dispatchEvent(new Event(MUSIC_EVENT));
    }

    /** Call from an existing trusted input handler; saved opt-in alone never starts audio. */
    unlock(): void {
        if (!this.enabled || document.hidden || this.pageAway) return;
        this.unlocked = true;
        try {
            const ctx = this.audioContext();
            this.cancelSuspend();
            if (ctx.state === 'running' && !this.suspending) { this.start(); return; }
            const generation = this.generation;
            // Call resume synchronously in the gesture, including after a pending suspend.
            // Retrying also matters if an earlier browser-blocked resume is still pending.
            void ctx.resume().then(() => {
                if (this.context === ctx && generation === this.generation && this.canPlay() && ctx.state === 'running') this.start();
            }).catch(() => {
                // A later gesture may retry; a rejected/unsupported audio API cannot break play.
            });
        } catch { /* Music is optional when Web Audio is unavailable. */ }
    }

    private canPlay(): boolean {
        return this.enabled && this.unlocked && !document.hidden && !this.pageAway;
    }

    private audioContext(): AudioContext {
        if (this.context && this.context.state !== 'closed') return this.context;
        const ctx = new AudioContext();
        const master = ctx.createGain(), filter = ctx.createBiquadFilter();
        master.gain.value = 0;
        filter.type = 'lowpass';
        filter.frequency.value = 1900;
        filter.Q.value = .45;
        filter.connect(master);
        master.connect(ctx.destination);
        this.context = ctx;
        this.master = master;
        this.filter = filter;
        ctx.addEventListener('statechange', () => {
            if (this.context !== ctx) return;
            if (ctx.state === 'running') {
                if (this.canPlay()) this.start();
                else this.pause();
            } else {
                this.stopScheduler();
                this.disposeVoices();
            }
        });
        return ctx;
    }

    private cancelSuspend(): void {
        if (this.suspendTimer !== null) clearTimeout(this.suspendTimer);
        this.suspendTimer = null;
    }

    private start(): void {
        const ctx = this.context, master = this.master;
        if (!ctx || !master || !this.canPlay() || ctx.state !== 'running' || this.scheduler !== null) return;
        this.cancelSuspend();
        this.disposeVoices();
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(0, now);
        master.gain.linearRampToValueAtTime(VOLUME, now + .5);
        this.nextBar = now + .04;
        this.barIndex = 0;
        this.schedule();
        this.scheduler = setInterval(() => this.schedule(), 250);
    }

    private stopScheduler(): void {
        if (this.scheduler !== null) clearInterval(this.scheduler);
        this.scheduler = null;
    }

    private pause(): void {
        this.generation++;
        this.stopScheduler();
        this.cancelSuspend();
        const ctx = this.context, master = this.master;
        if (!ctx || !master || ctx.state === 'closed') { this.disposeVoices(); return; }
        if (ctx.state !== 'running') { this.disposeVoices(); return; }
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
        for (const voice of this.voices) voice.stop(now + FADE_SECONDS);
        const generation = this.generation;
        this.suspendTimer = setTimeout(() => {
            this.suspendTimer = null;
            if (generation !== this.generation || this.canPlay()) return;
            this.disposeVoices();
            this.suspending = true;
            void ctx.suspend().catch(() => {}).finally(() => {
                this.suspending = false;
                // A quick re-enable can arrive while the suspend promise is settling.
                if (this.canPlay() && this.context === ctx) this.unlock();
            });
        }, Math.ceil(FADE_SECONDS * 1000) + 40);
    }

    private disposeVoices(): void {
        for (const voice of this.voices) voice.dispose();
        this.voices.clear();
    }

    private schedule(): void {
        const ctx = this.context;
        if (!ctx || !this.canPlay() || ctx.state !== 'running') { this.stopScheduler(); return; }
        // Do not replay missed bars in a burst after a long main-thread interruption.
        if (this.nextBar < ctx.currentTime - .1) this.nextBar = ctx.currentTime + .04;
        while (this.nextBar < ctx.currentTime + .5) {
            const index = this.barIndex++, bar = SCORE[index % SCORE.length];
            const at = this.nextBar, cycle = Math.floor(index / SCORE.length);
            bar.chord.forEach((note, voice) => this.note(at, note, 10.2, .024, (voice - 1.5) * .27, 'pad'));
            this.note(at + .12, bar.melody[0], 4.6, .036, -.24, 'bell');
            if ((cycle + index) % 3 !== 2) this.note(at + 4.65, bar.melody[1], 4.2, .025, .29, 'bell');
            this.note(at + .25, bar.bass, 2.2, .045, 0, 'pulse');
            this.note(at + 4.25, bar.bass + 12, 1.8, .016, .08, 'pulse');
            this.nextBar += BAR_SECONDS;
        }
    }

    private note(at: number, midi: number, length: number, level: number, pan: number, timbre: Timbre): void {
        const ctx = this.context, output = this.filter;
        if (!ctx || !output) return;
        const envelope = ctx.createGain(), panner = ctx.createStereoPanner();
        const oscillators: OscillatorNode[] = [], nodes: AudioNode[] = [envelope, panner];
        const frequency = 440 * 2 ** ((midi - 69) / 12);
        const attack = timbre === 'pad' ? 1.8 : timbre === 'bell' ? .035 : .3;
        const release = timbre === 'pad' ? 2.7 : timbre === 'bell' ? length - .14 : length - .4;
        envelope.gain.setValueAtTime(0, at);
        envelope.gain.linearRampToValueAtTime(level, at + attack);
        envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, level * (timbre === 'pad' ? .8 : .38)), at + length - release);
        envelope.gain.exponentialRampToValueAtTime(.0001, at + length);
        envelope.gain.linearRampToValueAtTime(0, at + length + .04);
        panner.pan.value = pan;
        envelope.connect(panner); panner.connect(output);
        const partials = timbre === 'pad' ? [[1, .49, -3], [1, .49, 3], [2, .045, 0]]
            : timbre === 'bell' ? [[1, .85, 0], [2, .13, 0], [3, .02, 0]] : [[1, .72, 0], [2, .28, 0]];
        let disposed = false;
        const voice: Voice = {
            stop: time => { for (const oscillator of oscillators) { try { oscillator.stop(time); } catch { /* Already ended. */ } } },
            dispose: () => {
                if (disposed) return;
                disposed = true;
                for (const oscillator of oscillators) { oscillator.onended = null; try { oscillator.stop(); } catch { /* Already ended. */ } }
                for (const node of nodes) node.disconnect();
                this.voices.delete(voice);
            },
        };
        this.voices.add(voice);
        for (const [multiple, weight, detune] of partials) {
            const oscillator = ctx.createOscillator(), mix = ctx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency * multiple;
            oscillator.detune.value = detune;
            mix.gain.value = weight;
            oscillator.connect(mix); mix.connect(envelope);
            oscillators.push(oscillator); nodes.push(oscillator, mix);
            oscillator.onended = () => voice.dispose();
            oscillator.start(at); oscillator.stop(at + length + .05);
        }
    }
}

export const music = new Music();
