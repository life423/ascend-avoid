import type { SyncedPractice } from '../types/synced';
import { PRACTICE_LESSONS, type PracticeLesson, isPracticeLesson } from '../../server/practice/definitions';
import { browserPracticeStore } from './progress';
import { sound } from '../core/Sound';
import { mouseControlEnabled, setMouseControl } from '../core/MouseControl';
import './practice.css';

export const LESSON_NAMES: Record<PracticeLesson, string> = { basics: 'Move, grow & capture', combat: 'Aim, hit & finish', defense: 'Escape & recover', blackhole: 'Black-hole shot', weapon: 'Build a weapon' };
const descriptions: Record<PracticeLesson, string> = { basics: 'Gather gems and capture a smaller healthy rival.', combat: 'Aim a shot, shatter a smaller rival, then learn an injured finish.', defense: 'Two exercises: Puff & flee, then Escape while injured.', blackhole: 'Capture a rival, then aim a long shot into the core.', weapon: 'Three matching parts. One automatic weapon.' };
const defenseStages: Record<string, string> = { 'rear-cover': 'Puff & flee', 'injured-escape': 'Escape while injured' };
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
  private currentLesson = '';
  private returnFocus: HTMLElement | null = null;
  private readyTouchAt = -Infinity;
  private touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  constructor(private choose: (lesson: PracticeLesson, sequence?: boolean) => void, private exit: () => void, private command: (type: string, data: unknown) => void, private cancel: (preserveMovement?: boolean) => void) {
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
    this.root.addEventListener('pointerdown', this.pointerDown);
    this.chooser.addEventListener('keydown', this.key);
    window.addEventListener('ascend:practice-open', this.open);
  }
  get modalOpen(): boolean { return !this.chooser.hidden; }
  get occupiedBottom(): number { return this.panel.hidden ? 0 : this.panel.getBoundingClientRect().bottom; }
  get actionsTop(): number {
    const actions = this.panel.querySelector<HTMLElement>('.practice-actions');
    return !this.panel.hidden && actions && getComputedStyle(actions).position === 'fixed' ? actions.getBoundingClientRect().top : Infinity;
  }
  begin(lesson: PracticeLesson): void {
    this.pendingLesson = lesson;
    this.active = true; this.view = null; this.signature = ''; this.currentLesson = ''; this.offer.hidden = true;
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
    if (this.pendingLesson && (view.lesson !== this.pendingLesson || !['ready', 'waiting', 'resolving'].includes(view.phase))) return;
    this.pendingLesson = null;
    if (isPracticeLesson(view.lesson) && this.currentLesson !== view.lesson && ['ready', 'waiting'].includes(view.phase)) {
      this.store.mark(view.lesson, 'in-progress'); this.currentLesson = view.lesson;
    }
    this.view = view;
    for (const id of PRACTICE_LESSONS) if (view.completed.split(',').includes(id)) this.store.mark(id, 'completed');
    if (view.phase === 'choosing') { if (!this.modalOpen) this.open(); return; }
    const key = [view.lesson, view.stage, view.phase, view.failures, view.cue, view.passed, view.feedback].join('/');
    if (key === this.signature) return; this.signature = key;
    const lesson = view.lesson as PracticeLesson;
    if (!isPracticeLesson(lesson)) return;
    let instruction = this.instruction(view);
    if (lesson === 'defense' && defenseStages[view.stage]) instruction = `${defenseStages[view.stage]}: ${instruction}`;
    if (view.phase === 'success') instruction = view.feedback || 'That worked.';
    if (view.phase === 'reset') instruction = view.feedback || 'This attempt is being restored.';
    const next = PRACTICE_LESSONS[PRACTICE_LESSONS.indexOf(lesson) + 1];
    if (view.phase === 'complete') instruction = view.sequence && next ? `Lesson complete. Next: ${LESSON_NAMES[next]}.` : 'Lesson complete. Take it into the arena.';
    if ((view.phase === 'complete' && view.sequence && !next) || view.phase === 'finished') instruction = PRACTICE_LESSONS.every(id => view.completed.split(',').includes(id)) ? 'Tutorial complete. You’re ready for the arena.' : 'Practice run finished. Revisit any unfinished lesson whenever you like.';
    const completed = (view.phase === 'complete' && !(view.sequence && next)) || view.phase === 'finished';
    const detailOpen = this.panel.querySelector('details')?.open ?? false;
    const active = ['waiting', 'resolving'].includes(view.phase);
    const injury = (lesson === 'combat' && ['wound', 'approach', 'steal', 'finish'].includes(view.stage)) || (lesson === 'defense' && view.stage === 'injured-escape' && view.phase === 'ready');
    const injuryText = lesson === 'defense'
      ? 'Movement still works while injured. Inhale and puff are blocked until your shell heals. A shot already held can still be fired.'
      : 'A split shell exposes gems. Inhale steals them: you grow and the rival shrinks. Move close for a mouth finish once you are 1.3× wider.';
    this.panel.dataset.phase = view.phase;
    this.panel.innerHTML = `<div class="practice-heading"><button type="button" data-do="open" aria-label="Choose any lesson">${LESSON_NAMES[lesson]} <span aria-hidden="true">⌄</span></button><span>${completed ? 'Finished' : `${Math.min(view.passed + 1, view.total)} / ${view.total}`}</span></div><p class="practice-instruction" role="status">${instruction}</p>${active && view.feedback ? `<p class="practice-feedback">${view.feedback}</p>` : ''}${view.failures >= 2 && active ? `<p class="practice-hint">${this.hint(view)}</p>` : ''}${injury ? `<details${detailOpen ? ' open' : ''}><summary>About injury</summary><p>${injuryText}</p></details>` : ''}<div class="practice-actions">${view.phase === 'ready' ? '<button type="button" data-do="ready" class="practice-primary">Ready</button>' : ''}${completed ? '<button type="button" data-do="exit" class="practice-primary">Play now</button><button type="button" data-do="open">Other lessons</button>' : '<button type="button" data-do="skip">Skip lesson</button>'}<button type="button" data-do="exit">Exit tutorial</button>${this.soundButton()}${this.mouseButton()}</div>`;
  }
  private soundButton(): string { return `<button type="button" data-do="sound" data-action="sound" aria-label="Mute sound" aria-pressed="${sound.muted}">Sound ${sound.muted ? 'off' : 'on'}</button>`; }
  private mouseButton(): string { return this.touch ? '' : `<button type="button" data-do="mouse" data-action="mouse" role="switch" aria-label="Mouse control" aria-checked="${mouseControlEnabled()}">Mouse <span>${mouseControlEnabled() ? 'On' : 'Off'}</span></button>`; }
  private actions(): string { return `<div class="practice-actions"><button type="button" data-do="skip">Skip lesson</button><button type="button" data-do="exit">Exit tutorial</button>${this.soundButton()}${this.mouseButton()}</div>`; }
  private instruction(v: SyncedPractice): string {
    const hold = this.touch ? 'Hold INHALE' : 'Hold Space';
    const fire = this.touch ? 'tap FIRE' : 'tap Space';
    if (v.lesson === 'basics') return v.stage === 'grow' ? (this.touch ? 'Use the left stick to gather gems. Soft bodies squish; keep moving.' : 'Move with WASD, arrows or the mouse. Gather gems and slide past the soft body.')
      : `${hold} toward the smaller healthy rival to capture it.`;
    if (v.lesson === 'combat') {
      if (v.stage === 'aim' && v.phase === 'ready') return this.touch
        ? 'Read first: drag on the right to aim, then lift before firing. Your captive waits here. Press Ready to begin.'
        : 'Read first: aim with the mouse or movement, then tap Space to fire. Your captive waits here. Press Ready to begin.';
      if (v.stage === 'aim') return this.touch ? 'Full cheeks: a shot is ready. Drag on the right to aim through the outlined rival. Do not fire yet.' : 'A shot is ready. Aim through the outlined rival with the mouse or movement. Do not fire yet.';
      if (v.stage === 'shatter') return `Aim set. You are over 20% wider. ${this.touch ? 'Lift your aiming thumb' : 'Release your aim'}, then ${fire} to shatter the rival.`;
      if (v.stage === 'wound') return `This larger rival will survive. Aim, then ${fire} to expose its gems.`;
      if (v.cue === 'recovering') return 'The split shell shows exposed gems. Move closer while the mint recovery ring fades.';
      if (v.stage === 'approach') return 'The split shell shows exposed gems. Move toward the injured rival.';
      if (v.stage === 'steal') return `Close enough. ${hold} to steal exposed gems: you grow and the rival shrinks.`;
      return 'Theft makes you bigger. Keep inhaling and move close for a mouth finish.';
    }
    if (v.lesson === 'blackhole') return v.stage === 'capture' ? `${hold} toward the marked rival to capture it.` : `Release, aim at the distant black core, then ${fire}.`;
    if (v.lesson === 'weapon') return v.stage === 'collect' ? 'Gather the three matching parts. They assemble automatically.'
      : v.stage === 'place' ? (this.touch ? 'Assembled. Tap Place weapon to deploy your Pulsar.' : 'Assembled. Press E to place your Pulsar.')
      : 'Placed. Your Pulsar charges and fires automatically. Watch it hit the marked rival.';
    if (v.stage === 'injured-escape') return v.phase === 'ready' ? `${this.touch ? 'Hold the left stick right' : 'Hold Right'}, away from the pursuer, then ${this.touch ? 'tap' : 'press'} Ready. Keep moving until your shell closes.` : 'Move away from the pursuer until your shell heals. You cannot inhale or puff.';
    if (v.phase === 'ready') return 'A pursuer starts behind you. Keep facing away, move right and tap a puff to leave rear cover.';
    if (v.cue === 'move-clear') return 'Rear cover broke suction. Keep moving beyond the wall.';
    if (v.cue === 'wrapping') return 'The wave is wrapping behind you. Keep moving clear.';
    return `Move right, away from the pursuer. ${this.touch ? 'Quick-tap INHALE' : 'Tap Space'} while fleeing to leave rear cover.`;
  }
  private hint(v: SyncedPractice): string {
    if (v.lesson === 'defense') return v.stage === 'injured-escape' ? 'Use movement only. Smaller bodies can outrun the larger pursuer; wait for the cracks to close.' : 'Use a quick tap, not a hold. Keep facing away; the wave wraps behind you. Keep moving after it forms.';
    if (v.stage === 'finish') return 'Keep the cracked rival in front. Move closer while inhaling; theft makes the size gap work for you.';
    if (['aim', 'shatter', 'wound', 'shoot'].includes(v.stage)) return this.touch ? 'Drag on the right, lift, then tap FIRE. Aim through the center.' : 'Aim with the mouse or movement. Release Space before tapping it again.';
    return 'Follow the single outlined target. Only this step needs another try.';
  }
  open = (): void => {
    this.cancel(); this.offer.hidden = true; this.store.offered(); this.returnFocus = document.activeElement as HTMLElement;
    this.chooser.innerHTML = `<div class="practice-dialog"><div class="practice-dialog-heading"><h2 id="practice-title">Practice / Tutorials</h2><button type="button" data-do="close" aria-label="Close lesson picker">Close</button></div><p>Follow all five in order, or choose any lesson.</p><button type="button" data-do="sequence" class="practice-start practice-primary">Start full tutorial</button><div class="practice-lessons">${PRACTICE_LESSONS.map(id => `<button type="button" data-lesson="${id}"><strong>${LESSON_NAMES[id]}</strong><span>${descriptions[id]}</span><small>${this.store.value.lessons[id] === 'completed' ? 'Completed' : this.store.value.lessons[id] === 'skipped' ? 'Unfinished · skipped' : this.store.value.legacyCompleted[id] ? 'Updated — try rear cover' : this.store.value.lessons[id] === 'in-progress' ? 'Unfinished · in progress' : 'Ready to try'}</small></button>`).join('')}</div><button type="button" data-do="${this.active ? 'exit' : 'close'}">${this.active ? 'Exit tutorial' : 'Keep playing'}</button></div>`;
    this.chooser.hidden = false; this.chooser.querySelector<HTMLButtonElement>('.practice-start')?.focus();
  };
  private close(): void { this.chooser.hidden = true; this.returnFocus?.focus(); this.returnFocus = null; }
  private startAttempt(): void {
    this.panel.querySelector('details')?.removeAttribute('open');
    if (!this.view || this.view.phase !== 'ready') return;
    this.cancel(true); this.command('practice:ready', { attempt: this.view.attempt });
    (document.activeElement as HTMLElement | null)?.blur();
  }
  private pointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' || (event.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.do !== 'ready') return;
    // A second thumb need not produce a compatibility click while the stick is held.
    event.preventDefault(); this.readyTouchAt = performance.now(); this.startAttempt();
  };
  private click = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return;
    const lesson = button.dataset.lesson;
    if (isPracticeLesson(lesson)) { this.begin(lesson); this.choose(lesson); (document.activeElement as HTMLElement | null)?.blur(); return; }
    switch (button.dataset.do) {
      case 'sequence': this.begin('basics'); this.choose('basics', true); (document.activeElement as HTMLElement | null)?.blur(); break;
      case 'open': this.open(); break;
      case 'sound': sound.toggle(); break;
      case 'mouse': this.cancel(); setMouseControl(!mouseControlEnabled()); break;
      case 'ready':
        if (!event.detail || performance.now() - this.readyTouchAt >= 700) this.startAttempt();
        break;
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
