/**
 * Utility functions for the game
 * Now with TypeScript support.
 */

/**
 * Generates a random integer between min and max (inclusive)
 * @param min - The minimum value
 * @param max - The maximum value
 * @returns A random integer between min and max
 */
export function randomIntFromInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Global scaling factor for game elements
export const SCALE_FACTOR = 1;

// Base canvas dimensions - will be used as a reference for scaling
export const BASE_CANVAS_WIDTH = 560;
export const BASE_CANVAS_HEIGHT = 550;

