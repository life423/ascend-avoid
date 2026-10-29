/** Scenario identifiers and geometry only; instructional copy belongs to the client. */
export const PRACTICE_LESSONS = ['basics', 'weapon', 'blackhole', 'defense'] as const;
export type PracticeLesson = typeof PRACTICE_LESSONS[number];
export const PRACTICE_STAGES: Record<PracticeLesson, readonly string[]> = {
  basics: ['grow', 'capture', 'shoot', 'finish'],
  weapon: ['collect', 'place', 'effect'],
  blackhole: ['shoot'],
  defense: ['parry'],
};
export function isPracticeLesson(value: unknown): value is PracticeLesson {
  return typeof value === 'string' && PRACTICE_LESSONS.some(id => id === value);
}
export const PRACTICE_ARENA = { width: 1600, height: 1600, x: 560, y: 800, idleMs: 10 * 60_000, finishedMs: 60_000 } as const;
