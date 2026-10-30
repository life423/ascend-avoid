import type { SyncedPractice } from '../types/synced';
import { PRACTICE_LESSONS, type PracticeLesson, isPracticeLesson } from '../../server/practice/definitions';
import { browserPracticeStore } from './progress';
import { sound } from '../core/Sound';
import './practice.css';

export const LESSON_NAMES: Record<PracticeLesson, string> = { basics: 'Grow, capture & finish', weapon: 'Build a weapon', blackhole: 'Black-hole shot', defense: 'Defensive burst' };
const descriptions = { basics: 'Gather, capture, aim, then finish a larger rival.', weapon: 'Three matching parts. One automatic weapon.', blackhole: 'Capture a rival, then aim a long shot into the core.', defense: 'Break a warned suction attack with a puff.' };
export class PracticeUI {
  private store = browserPracticeStore();
  private root = document.createElement('div');
  private offer = document.createElement('aside');
  private panel = document.createElement('section');
  private chooser = document.createElement('div');
  private view: SyncedPractice | null = null;
  private active = false;
  private pendingLesson: PracticeLesson | null = null;
  private signature = '';
  private returnFocus: HTMLElement | null = null;
  private touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  constructor(private choose: (lesson: PracticeLesson, sequence?: boolean) => void, private exit: () => void, private command: (type: string, data: unknown) => void, private cancel: () => void) {
    this.root.className = 'practice-ui';
    this.offer.className = 'practice-offer'; this.offer.hidden = true;
    this.offer.setAttribute('aria-label', 'Optional practice');
    this.offer.innerHTML = '<span>New here? Learn the moves.</span><button type="button" data-do="sequence" class="practice-primary">Play tutorial</button><button type="button" data-do="dismiss">Not now</button>';
    this.panel.className = 'practice-panel'; this.panel.hidden = true;
    this.panel.setAttribute('aria-label', 'Current tutorial lesson');
    this.chooser.className = 'practice-chooser'; this.chooser.hidden = true;
    this.chooser.setAttribute('role', 'dialog'); this.chooser.setAttribute('aria-modal', 'true'); this.chooser.setAttribute('aria-labelledby', 'practice-title');
    this.root.append(this.offer, this.panel, this.chooser); document.body.append(this.root);
    this.root.addEventListener('click', this.click);
    this.chooser.addEventListener('keydown', this.key);
    window.addEventListener('ascend:practice-open', this.open);
  }
  get modalOpen(): boolean { return !this.chooser.hidden; }
  begin(lesson: PracticeLesson): void {
    this.pendingLesson = lesson;
    this.active = true; this.view = null; this.signature = ''; this.offer.hidden = true;
    this.store.mark(lesson, 'in-progress'); this.close(); document.body.classList.add('practice-mode');
    this.panel.hidden = false;
    this.panel.innerHTML = `<div class="practice-heading">${LESSON_NAMES[lesson]}</div><p role="status">Preparing your private arena…</p>${this.actions()}`;
  }
  stop(): void {
    this.cancel(); this.active = false; this.view = null; this.close(); this.panel.hidden = true;
    document.body.classList.remove('practice-mode');
  }
  connectionClosed(): void {
    if (!this.active) return;
    this.cancel(); this.close(); this.view = null;
    this.panel.innerHTML = '<div class="practice-heading">Practice paused</div><p class="practice-instruction" role="status">Your private session ended. Choose any lesson to start again.</p><div class="practice-actions"><button type="button" data-do="open">Choose lesson</button><button type="button" data-do="exit">Exit tutorial</button></div>';
  }
  offerIfReady(): void {
    if (!this.active && !this.modalOpen && this.store.shouldOffer) {
      this.offer.hidden = false; this.store.offered();
      setTimeout(() => { this.offer.hidden = true; }, 8000);
    }
  }
  update(view: SyncedPractice | undefined): void {
    if (!this.active || !view?.enabled) return;
    if (this.pendingLesson && (view.lesson !== this.pendingLesson || view.phase !== 'waiting')) return;
    this.pendingLesson = null;
    if (isPracticeLesson(view.lesson) && this.view?.lesson !== view.lesson && view.phase === 'waiting') this.store.mark(view.lesson, 'in-progress');
    this.view = view;
    for (const id of PRACTICE_LESSONS) if (view.completed.split(',').includes(id)) this.store.mark(id, 'completed');
    if (view.phase === 'choosing') { if (!this.modalOpen) this.open(); return; }
    const key = [view.lesson, view.stage, view.phase, view.failures, view.cue, view.passed].join('/');
    if (key === this.signature) return; this.signature = key;
    const lesson = view.lesson as PracticeLesson;
    if (!isPracticeLesson(lesson)) return;
    let instruction = this.instruction(view);
    if (view.phase === 'success') instruction = view.lesson === 'blackhole' && view.stage === 'shoot' ? 'Watch their gems return to you.' : 'That worked.';
    if (view.phase === 'reset') instruction = 'Try again — this attempt is being restored.';
    const next = PRACTICE_LESSONS[PRACTICE_LESSONS.indexOf(lesson) + 1];
    if (view.phase === 'complete') instruction = view.sequence && next ? `Lesson complete. Next: ${LESSON_NAMES[next]}.` : 'Lesson complete. Take it into the arena.';
    if ((view.phase === 'complete' && view.sequence && !next) || view.phase === 'finished') instruction = PRACTICE_LESSONS.every(id => view.completed.split(',').includes(id)) ? 'Tutorial complete. You’re ready for the arena.' : 'Practice run finished. Revisit any unfinished lesson whenever you like.';
    const completed = (view.phase === 'complete' && !(view.sequence && next)) || view.phase === 'finished';
    this.panel.innerHTML = `<div class="practice-heading"><button type="button" data-do="open" aria-label="Choose any lesson">${LESSON_NAMES[lesson]} <span aria-hidden="true">⌄</span></button><span>${completed ? 'Finished' : `${view.passed + 1} / ${view.total}`}</span></div><p class="practice-instruction" role="status">${instruction}</p>${view.failures >= 2 && view.phase === 'waiting' ? `<p class="practice-hint">${this.hint(view)}</p>` : ''}${view.stage === 'finish' ? '<details><summary>About injury</summary><p>Cracks mean gems can be stolen: theft shrinks them and grows you. A mouth finish still needs 1.3× width and close contact. Injury stops inhale and empty-mouth puffs, not movement or an already-held shot after release. The usual seven seconds can continue while valid theft stays unbroken. Impact stun is separate.</p></details>' : ''}<div class="practice-actions">${completed ? '<button type="button" data-do="exit" class="practice-primary">Play now</button><button type="button" data-do="open">Other lessons</button>' : '<button type="button" data-do="skip">Skip lesson</button>'}<button type="button" data-do="exit">Exit tutorial</button>${this.soundButton()}</div>`;
  }
  private soundButton(): string { return `<button type="button" data-do="sound" data-action="sound" aria-label="Mute sound" aria-pressed="${sound.muted}">Sound ${sound.muted ? 'off' : 'on'}</button>`; }
  private actions(): string { return `<div class="practice-actions"><button type="button" data-do="skip">Skip lesson</button><button type="button" data-do="exit">Exit tutorial</button>${this.soundButton()}</div>`; }
  private instruction(v: SyncedPractice): string {
    const hold = this.touch ? 'Hold INHALE' : 'Hold Space';
    const fire = this.touch ? 'tap FIRE' : 'tap Space';
    if (v.lesson === 'basics') return v.stage === 'grow' ? (this.touch ? 'Use the left stick to gather the marked gems.' : 'Move with WASD, arrows or the mouse to gather the marked gems.')
      : v.stage === 'capture' ? `${hold} toward the small healthy rival to capture it.`
      : v.stage === 'shoot' ? `Release, aim at the larger rival, then ${fire}.`
      : v.cue === 'recovering' ? 'The mint ring briefly blocks suction. Aim, then inhale as it fades.'
      : v.cue === 'resume-inhale' ? `A bump stopped your inhale. Release, then ${hold.toLowerCase()} again.`
      : `${hold} toward the cracked rival. Let theft grow you, then move close for a mouth finish.`;
    if (v.lesson === 'blackhole') return v.stage === 'capture' ? `${hold} toward the marked rival to capture it.` : `Release, aim at the distant black core, then ${fire}.`;
    if (v.lesson === 'weapon') return v.stage === 'collect' ? 'Gather the three matching parts. They assemble automatically.'
      : v.stage === 'place' ? (this.touch ? 'Tap Place weapon to deploy your assembled Pulsar.' : 'Press E to place your assembled Pulsar.')
      : 'Your Pulsar charges and fires automatically. Watch it hit the marked rival.';
    return v.cue === 'warning' ? 'Face the marked attacker. Wait for its suction.' : `Suction now — ${this.touch ? 'tap INHALE' : 'tap Space'} for a defensive puff.`;
  }
  private hint(v: SyncedPractice): string {
    if (v.lesson === 'defense') return 'Use a quick tap, not a hold. Face the attacker and wait until its airflow reaches you.';
    if (v.stage === 'finish') return 'Keep the cracked rival in front. Move closer while inhaling; theft makes the size gap work for you.';
    if (v.stage === 'shoot') return this.touch ? 'With a full mouth, drag on the right to aim. Lift, then tap FIRE. Aim through the center.' : 'With a full mouth, aim with the mouse or movement. Release Space before tapping it again.';
    return 'Follow the single outlined target. Only this step needs another try.';
  }
  open = (): void => {
    this.cancel(); this.offer.hidden = true; this.store.offered(); this.returnFocus = document.activeElement as HTMLElement;
    this.chooser.innerHTML = `<div class="practice-dialog"><div class="practice-dialog-heading"><h2 id="practice-title">Practice / Tutorials</h2><button type="button" data-do="close" aria-label="Close lesson picker">Close</button></div><p>Follow all four in order, or choose any lesson.</p><button type="button" data-do="sequence" class="practice-start practice-primary">Start full tutorial</button><div class="practice-lessons">${PRACTICE_LESSONS.map(id => `<button type="button" data-lesson="${id}"><strong>${LESSON_NAMES[id]}</strong><span>${descriptions[id]}</span><small>${this.store.value.lessons[id] === 'completed' ? 'Completed' : this.store.value.lessons[id] === 'skipped' ? 'Unfinished · skipped' : this.store.value.lessons[id] === 'in-progress' ? 'Unfinished · in progress' : 'Ready to try'}</small></button>`).join('')}</div><button type="button" data-do="${this.active ? 'exit' : 'close'}">${this.active ? 'Exit tutorial' : 'Keep playing'}</button></div>`;
    this.chooser.hidden = false; this.chooser.querySelector<HTMLButtonElement>('.practice-start')?.focus();
  };
  private close(): void { this.chooser.hidden = true; this.returnFocus?.focus(); this.returnFocus = null; }
  private click = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return;
    const lesson = button.dataset.lesson;
    if (isPracticeLesson(lesson)) { this.begin(lesson); this.choose(lesson); (document.activeElement as HTMLElement | null)?.blur(); return; }
    switch (button.dataset.do) {
      case 'sequence': this.begin('basics'); this.choose('basics', true); (document.activeElement as HTMLElement | null)?.blur(); break;
      case 'open': this.open(); break;
      case 'sound': sound.toggle(); break;
      case 'dismiss': this.store.skipOffer(); this.offer.hidden = true; break;
      case 'close': this.close(); break;
      case 'exit': this.stop(); this.exit(); break;
      case 'skip':
        if (this.view && isPracticeLesson(this.view.lesson)) { this.cancel(); this.store.mark(this.view.lesson, 'skipped'); this.command('practice:skip', { attempt: this.view.attempt }); if (!this.view.sequence) this.open(); }
        else { this.stop(); this.exit(); }
        break;
    }
  };
  private key = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); return; }
    if (e.key !== 'Tab') return;
    const buttons = [...this.chooser.querySelectorAll<HTMLButtonElement>('button')];
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
}
