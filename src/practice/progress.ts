import { PRACTICE_LESSONS, type PracticeLesson } from '../../server/practice/definitions';

export const PRACTICE_KEY = 'ascend.practice.v1';
export type LessonStatus = 'not-started' | 'in-progress' | 'skipped' | 'completed';
export interface PracticeProgress { version: 1; offered: boolean; status: LessonStatus; lessons: Record<PracticeLesson, LessonStatus> }
const empty = (): PracticeProgress => ({ version: 1, offered: false, status: 'not-started', lessons: { basics: 'not-started', weapon: 'not-started', blackhole: 'not-started', defense: 'not-started' } });
/** Optional local persistence; memory still works when storage is blocked. */
export class PracticeStore {
  value = empty();
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null) {
    try {
      const saved = JSON.parse(storage?.getItem(PRACTICE_KEY) ?? 'null');
      if (saved?.version === 1) {
        this.value.offered = saved.offered === true;
        if (['not-started', 'in-progress', 'skipped', 'completed'].includes(saved.status)) this.value.status = saved.status;
        for (const id of PRACTICE_LESSONS) if (['not-started', 'in-progress', 'skipped', 'completed'].includes(saved.lessons?.[id])) this.value.lessons[id] = saved.lessons[id];
      }
    } catch { /* Corrupt or blocked storage starts a fresh optional record. */ }
  }
  get shouldOffer(): boolean {
    try { if (this.storage?.getItem('ascend.guideSeen') === 'true') return false; } catch { /* memory fallback */ }
    return !this.value.offered && PRACTICE_LESSONS.every(id => this.value.lessons[id] === 'not-started');
  }
  skipOffer(): void { this.value.status = 'skipped'; this.offered(); }
  offered(): void { this.value.offered = true; this.save(); }
  mark(id: PracticeLesson, status: LessonStatus): void {
    if (this.value.lessons[id] === status && this.value.offered) return;
    // Skipping a replay cannot erase an earlier verified completion.
    if (this.value.lessons[id] !== 'completed' || status === 'completed') this.value.lessons[id] = status;
    this.value.status = PRACTICE_LESSONS.every(id => this.value.lessons[id] === 'completed') ? 'completed' : status === 'skipped' ? 'skipped' : 'in-progress';
    this.value.offered = true; this.save();
  }
  private save(): void { try { this.storage?.setItem(PRACTICE_KEY, JSON.stringify(this.value)); } catch { /* memory fallback */ } }
}
export function browserPracticeStore(): PracticeStore {
  try { return new PracticeStore(localStorage); } catch { return new PracticeStore(null); }
}
