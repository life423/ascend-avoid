/** Scenario identifiers and geometry only; instructional copy belongs to the client. */
export const PRACTICE_LESSONS = ['basics', 'combat', 'defense', 'blackhole', 'weapon', 'asteroid'] as const;
export type PracticeLesson = typeof PRACTICE_LESSONS[number];
export const PRACTICE_STAGES: Record<PracticeLesson, readonly string[]> = {
  basics: ['grow', 'capture'],
  combat: ['aim', 'shatter', 'wound', 'approach', 'steal', 'finish'],
  weapon: ['collect', 'place', 'effect'],
  blackhole: ['capture', 'shoot'],
  defense: ['rear-cover', 'injured-escape'],
  asteroid: ['hook', 'tow', 'strike'],
};
export function isPracticeLesson(value: unknown): value is PracticeLesson {
  return typeof value === 'string' && PRACTICE_LESSONS.some(id => id === value);
}
export const PRACTICE_ARENA = { width: 1600, height: 2000, x: 560, y: 800, idleMs: 10 * 60_000, finishedMs: 60_000 } as const;
export const COMBAT_LESSON = { targetX: 240, targetY: -80 } as const;
export const BLACK_HOLE_LESSON = { x: 1080, y: PRACTICE_ARENA.y, height: 2000, rewardMs: 2400 } as const;
export const DEFENSE_LESSON = { width: 4200, height: 4200, learnerX: 900, injuredGap: 600, pursuitMs: 250 } as const;

export const ASTEROID_LESSON = { width: 4200, height: 4200, gems: 33_000, x: 900, y: 1000, relicX: 1800, relicY: 1000, relayX: 2600, relayY: 2500, targetX: 1300, targetY: 2700, targetGems: 10_000 } as const;
