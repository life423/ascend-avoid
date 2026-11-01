import type { Client } from 'colyseus';
import { timingSafeEqual } from 'node:crypto';
import { GameRoom } from './GameRoom.js';
import { createPracticeArena } from '../practice/arena.js';
import { PracticeController } from '../practice/PracticeController.js';
import { isPracticeLesson, type PracticeLesson } from '../practice/definitions.js';

/** Explicitly created capability-protected room. Never part of public matchmaking. */
export class TutorialRoom extends GameRoom {
  maxClients = 1;
  private capability = '';
  private owner = '';
  private initialLesson: PracticeLesson = 'basics';
  private sequence = false;
  private controller!: PracticeController;
  protected get testHooksEnabled(): boolean { return false; }
  protected get gameplayReady(): boolean { return !['ready', 'countdown'].includes(this.state.practice.phase); }

  protected async configureArena(options: Record<string, unknown>): Promise<void> {
    if (typeof options.token !== 'string' || !/^[a-f0-9]{64}$/.test(options.token)) throw new Error('Practice requires a private capability');
    this.capability = options.token;
    if (isPracticeLesson(options.lesson)) this.initialLesson = options.lesson;
    this.sequence = options.sequence === true;
    await this.setPrivate(true);
    this.setState(createPracticeArena());
    this.controller = new PracticeController(this.state);
    // An unclaimed seat must not leave a room running indefinitely.
    this.clock.setTimeout(() => { if (!this.owner) void this.disconnect(); }, 30_000);
    this.onMessage('practice:lesson', (client, data) => {
      if (!this.allowMessage(client) || client.sessionId !== this.owner || !isPracticeLesson(data?.lesson)) return;
      this.controller.select(data.lesson, data.replay === true, Date.now());
    });
    this.onMessage('practice:start', client => {
      if (this.allowMessage(client) && client.sessionId === this.owner) this.controller.startSequence(Date.now());
    });
    this.onMessage('practice:skip', (client, data) => {
      if (this.allowMessage(client) && client.sessionId === this.owner) this.controller.skip(data?.attempt, Date.now());
    });
    this.onMessage('practice:retry', (client, data) => {
      if (this.allowMessage(client) && client.sessionId === this.owner) this.controller.retry(data?.attempt, Date.now());
    });
    this.onMessage('practice:ready', (client, data) => {
      if (this.allowMessage(client) && client.sessionId === this.owner) this.controller.ready(data?.attempt, Date.now());
    });
    this.onMessage('practice:pause', (client, data) => {
      if (this.allowMessage(client) && client.sessionId === this.owner) this.controller.pauseCountdown(data?.attempt, Date.now());
    });
  }
  onAuth(client: Client, options: Record<string, unknown>): boolean {
    const token = typeof options.token === 'string' ? options.token : '';
    if (!/^[a-f0-9]{64}$/.test(token) || token.length !== this.capability.length || !timingSafeEqual(Buffer.from(token), Buffer.from(this.capability))) return false;
    if (this.owner && this.owner !== client.sessionId) return false;
    this.owner = client.sessionId;
    return true;
  }
  onJoin(client: Client, options: { name?: unknown } = {}): void {
    super.onJoin(client, options);
    this.controller.attach(client.sessionId, this.initialLesson, Date.now());
    if (this.sequence) {
      if (this.initialLesson === 'basics') this.controller.startSequence(Date.now());
      else this.controller.select(this.initialLesson, true, Date.now(), true);
    }
    void this.lock();
  }
  protected observeEvent(type: string, data: Record<string, unknown>): void {
    this.controller.observe(type, data, Date.now());
  }
  protected stepArena(deltaMs: number): void {
    if (!this.owner) return;
    const now = Date.now();
    if (this.controller.shouldClose(now)) { void this.disconnect(); return; }
    if (!this.controller.connected) return;
    const p = this.state.players.get(this.owner);
    if (this.state.practice.phase === 'waiting' && (p?.inhaling || p?.steering().x || p?.steering().y)) this.controller.activity(now);
    this.controller.beforeTick(now);
    super.stepArena(deltaMs);
    this.controller.afterTick(now);
  }
  async onLeave(client: Client, consented = false): Promise<void> {
    const p = this.state.players.get(client.sessionId);
    p?.stopInhale(); p?.steer(0, 0); p?.aimAt(0, 0);
    this.controller.pauseCountdown(this.state.practice.attempt, Date.now());
    this.controller.connected = false;
    if (!consented) {
      try { await this.allowReconnection(client, 10); this.controller.connected = true; return; }
      catch { /* Expired reconnection is an ordinary departure. */ }
    }
    super.onLeave(client, true);
  }
}
