import { PRACTICE_LESSONS, type PracticeLesson } from '../../server/practice/definitions';

export const PRACTICE_KEY = 'ascend.practice.v2';
const LEGACY_KEY = 'ascend.practice.v1';
export type LessonStatus = 'not-started' | 'in-progress' | 'skipped' | 'completed';
export interface PracticeProgress {
  version: 2;
  offered: boolean;
  status: LessonStatus;
  lessons: Record<PracticeLesson, LessonStatus>;
  legacyCompleted: Partial<Record<PracticeLesson, boolean>>;
  lessonRevisions: Partial<Record<PracticeLesson, number>>;
}
const statuses: readonly string[] = ['not-started', 'in-progress', 'skipped', 'completed'];
const validStatus = (value: unknown): value is LessonStatus => typeof value === 'string' && statuses.includes(value);
const empty = (): PracticeProgress => ({ version: 2, offered: false, status: 'not-started',
  lessons: { basics: 'not-started', combat: 'not-started', defense: 'not-started', blackhole: 'not-started', weapon: 'not-started', asteroid: 'not-started' }, legacyCompleted: {}, lessonRevisions: { asteroid: 2 } });

/** Old achievements survive without certifying newly added practice skills. */
export class PracticeStore {
  value = empty();
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null) {
    try {
      const current = JSON.parse(storage?.getItem(PRACTICE_KEY) ?? 'null');
      if (current?.version === 2) {
        this.value.offered = current.offered === true;
        for (const id of PRACTICE_LESSONS) {
          if (validStatus(current.lessons?.[id])) this.value.lessons[id] = current.lessons[id];
          if (current.legacyCompleted?.[id] === true) this.value.legacyCompleted[id] = true;
        }
        const oldAsteroid = current.lessonRevisions?.asteroid !== 2 &&
          ['completed', 'in-progress'].includes(this.value.lessons.asteroid);
        if (oldAsteroid) {
          if (this.value.lessons.asteroid === 'completed') this.value.legacyCompleted.asteroid = true;
          this.value.lessons.asteroid = 'not-started';
        }
        this.refreshStatus();
        if (current.status === 'skipped' && this.value.status === 'not-started') this.value.status = 'skipped';
        if (oldAsteroid) this.save();
        return;
      }
      const old = JSON.parse(storage?.getItem(LEGACY_KEY) ?? 'null');
      if (old?.version === 1) {
        this.value.offered = old.offered === true;
        for (const id of ['basics', 'weapon', 'blackhole'] as const) if (validStatus(old.lessons?.[id])) this.value.lessons[id] = old.lessons[id];
        if (old.lessons?.defense === 'completed') this.value.legacyCompleted.defense = true;
        else if (validStatus(old.lessons?.defense)) this.value.lessons.defense = old.lessons.defense;
        this.refreshStatus();
        if (validStatus(old.status) && old.status === 'skipped' && this.value.status === 'not-started') this.value.status = 'skipped';
        this.save();
      }
    } catch { /* Corrupt/blocked storage never prevents practice. */ }
  }
  private refreshStatus(): void {
    const lessons = Object.values(this.value.lessons);
    this.value.status = lessons.every(s => s === 'completed') ? 'completed'
      : lessons.some(s => s === 'in-progress' || s === 'completed') ? 'in-progress'
      : lessons.some(s => s === 'skipped') ? 'skipped' : 'not-started';
  }
  get shouldOffer(): boolean {
    try { if (this.storage?.getItem('ascend.guideSeen') === 'true') return false; } catch { /* memory fallback */ }
    return !this.value.offered && PRACTICE_LESSONS.every(id => this.value.lessons[id] === 'not-started') && !Object.keys(this.value.legacyCompleted).length;
  }
  skipOffer(): void { this.value.status = 'skipped'; this.offered(); }
  offered(): void { this.value.offered = true; this.save(); }
  mark(id: PracticeLesson, status: LessonStatus): void {
    if (this.value.lessons[id] === status && this.value.offered) return;
    if (this.value.lessons[id] !== 'completed' || status === 'completed') this.value.lessons[id] = status;
    this.refreshStatus();
    this.value.offered = true; this.save();
  }
  private save(): void { try { this.storage?.setItem(PRACTICE_KEY, JSON.stringify(this.value)); } catch { /* memory fallback */ } }
}
export function browserPracticeStore(): PracticeStore {
  try { return new PracticeStore(localStorage); } catch { return new PracticeStore(null); }
}
