type Cue = 'gem' | 'capture' | 'ready' | 'launch' | 'impact' | 'parry' | 'surge';
const NOTES: Record<Cue, [number, number, number]> = {
    gem: [720, 1050, 0.07], capture: [180, 390, 0.18], ready: [600, 1000, 0.16],
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
        if (!this.muted) { this.unlock(); this.play('gem'); }
    }
    play(cue: Cue): void {
        const ctx = this.context;
        if (this.muted || !ctx || ctx.state !== 'running') return;
        const now = ctx.currentTime;
        if (now - (this.last.get(cue) ?? -10) < (cue === 'gem' ? 0.09 : 0.15)) return;
        this.last.set(cue, now);
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
