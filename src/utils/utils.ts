/** Generates a random integer between min and max (inclusive). */
export function randomIntFromInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Fixed reference scale and dimensions used by the single-player fallback.
export const SCALE_FACTOR = 1;
export const BASE_CANVAS_WIDTH = 560;
export const BASE_CANVAS_HEIGHT = 550;
