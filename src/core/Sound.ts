type Cue = 'gem' | 'capture' | 'ready' | 'launch' | 'impact' | 'cannon' | 'shatter' | 'parry' | 'surge';
export const SOUND_EVENT = 'ascend:sound';
const NOTES: Record<Cue, [number, number, number]> = {
    gem: [720, 1050, 0.07], capture: [180, 390, 0.18], ready: [600, 1000, 0.16],
    cannon: [110, 38, .22], shatter: [135, 32, .28],
    launch: [700, 90, 0.22], impact: [150, 45, 0.2], parry: [350, 850, 0.12], surge: [440, 880, 0.25],
};

/** Small synthesized cues, only after a gesture; no network assets or autoplay. */
class Sound {
    private context: AudioContext | null = null;
    private last = new Map<Cue, number>();
    muted = false;
    constructor() {
        try { this.muted = localStorage.getItem('ascend.muted') === 'true'; } catch { /* optional storage */ }
    }
    unlock(): void {
        if (this.muted) return;
        try {
            this.context ??= new AudioContext();
            if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
        } catch { /* Audio is optional on unsupported browsers. */ }
    }
    toggle(): void {
        this.muted = !this.muted;
        try { localStorage.setItem('ascend.muted', String(this.muted)); } catch { /* optional storage */ }
        if (this.muted) void this.context?.suspend().catch(() => {});
        if (!this.muted) { this.unlock(); this.play('gem'); }
        window.dispatchEvent(new Event(SOUND_EVENT));
    }
    private noise: AudioBuffer | null = null;
    private cannonContact(shatter: boolean): void {
        const ctx = this.context!;
        const now = ctx.currentTime, duration = shatter ? .28 : .2;
        const body = ctx.createOscillator(), gain = ctx.createGain();
        body.type = 'sine'; body.frequency.setValueAtTime(shatter ? 125 : 105, now);
        body.frequency.exponentialRampToValueAtTime(34, now + duration);
        gain.gain.setValueAtTime(.085, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
        body.connect(gain); gain.connect(ctx.destination); body.start(now); body.stop(now + duration);
        body.onended = () => { body.disconnect(); gain.disconnect(); };
        if (!this.noise) {
            this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .28), ctx.sampleRate);
            const samples = this.noise.getChannelData(0);
            for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        }
        const crack = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
        crack.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = shatter ? 2200 : 1100;
        envelope.gain.setValueAtTime(shatter ? .075 : .055, now); envelope.gain.exponentialRampToValueAtTime(.001, now + duration * .8);
        crack.connect(filter); filter.connect(envelope); envelope.connect(ctx.destination); crack.start(now); crack.stop(now + duration);
        crack.onended = () => { crack.disconnect(); filter.disconnect(); envelope.disconnect(); };
    }
    play(cue: Cue): void {
        const ctx = this.context;
        if (this.muted || !ctx || ctx.state !== 'running') return;
        const now = ctx.currentTime;
        if (now - (this.last.get(cue) ?? -10) < (cue === 'gem' ? 0.09 : 0.15)) return;
        this.last.set(cue, now);
        if (cue === 'cannon' || cue === 'shatter') { this.cannonContact(cue === 'shatter'); return; }
        const [from, to, length] = NOTES[cue];
        const oscillator = ctx.createOscillator();
        const volume = ctx.createGain();
        oscillator.type = cue === 'impact' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(from, now);
        oscillator.frequency.exponentialRampToValueAtTime(to, now + length);
        volume.gain.setValueAtTime(0.035, now);
        volume.gain.exponentialRampToValueAtTime(0.001, now + length);
        oscillator.connect(volume);
        volume.connect(ctx.destination);
        oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
        oscillator.start(now);
        oscillator.stop(now + length);
    }
}
export const sound = new Sound();
