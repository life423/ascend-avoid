/**
 * Utility functions for the game
 * Now with TypeScript support.
 */
import { ScalingInfo } from '../types';

/**
 * Generates a random integer between min and max (inclusive)
 * @param min - The minimum value
 * @param max - The maximum value
 * @returns A random integer between min and max
 */
export function randomIntFromInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Singleton audio context to avoid multiple instances
let audioContext: AudioContext | null = null;

/**
 * Sound types available in the game
 */
export type SoundType = 'collision' | 'score' | string;

/**
 * Play a simple sound effect
 * @param type - The type of sound ('collision', 'score', etc.)
 * @param volume - The volume of the sound (0-1)
 */
export function playSound(type: SoundType, volume: number = 0.1): void {
  // Don't attempt sound on browsers that don't support AudioContext
  if (!('AudioContext' in window) && !('webkitAudioContext' in window)) {
    return;
  }
  
  try {
    // Create AudioContext only once
    if (!audioContext) {
      try {
        // Use type assertion to avoid TypeScript errors with webkitAudioContext
        const AudioContextClass = window.AudioContext || 
          (window as any).webkitAudioContext;
        audioContext = new AudioContextClass();
      } catch (e) {
        console.log("Failed to create AudioContext:", e);
        return; // Exit if we can't create the context
      }
    }
    
    // Don't proceed if audio context is in a bad state
    if (audioContext.state === 'suspended' || audioContext.state === 'closed') {
      try {
        audioContext.resume();
      } catch (e) {
        console.log("Failed to resume AudioContext:", e);
        return;
      }
    }
    
    // Create gain node to control volume
    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume; // Control volume through parameter
    gainNode.connect(audioContext.destination);
    
    // Create and configure oscillator
    const oscillator = audioContext.createOscillator();
    
    switch (type) {
      case 'collision':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3 note
        break;
      case 'score':
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
        break;
      default:
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(330, audioContext.currentTime);
    }
    
    // Connect to gain node instead of directly to destination
    oscillator.connect(gainNode);
    
    // Add fade out
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    
    // Play the sound
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    console.log("Error playing sound:", e);
  }
}

// Global scaling factor for game elements
export let SCALE_FACTOR = 1;

// Base canvas dimensions - will be used as a reference for scaling
export const BASE_CANVAS_WIDTH = 560;
export const BASE_CANVAS_HEIGHT = 550;

// Aspect ratio of the game
export const ASPECT_RATIO = BASE_CANVAS_HEIGHT / BASE_CANVAS_WIDTH;

/**
 * Resize the canvas to be responsive while maintaining aspect ratio
 * @param canvas - The canvas element to resize
 * @returns The scale factors for width and height
 */
export function resizeCanvas(canvas: HTMLCanvasElement): ScalingInfo {
  // Get container dimensions
  const container = canvas.parentElement as HTMLElement;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight || 550; // Default if height not set
  const isDesktop = window.matchMedia("(min-width: 1200px)").matches;
  
  let canvasWidth: number;
  let canvasHeight: number;
  
  if (isDesktop) {
    // DESKTOP: Use container dimensions directly
    canvasWidth = containerWidth;
    // Ensure minimum height while respecting container dimensions
    canvasHeight = Math.max(containerHeight, 550);
    
    // Apply max-width constraint if needed
    const maxWidth = 1200; // Match CSS max-width
    if (canvasWidth > maxWidth) {
      canvasWidth = maxWidth;
      canvasHeight = canvasWidth * ASPECT_RATIO;
    }
    
    // Check if height would exceed window constraints
    const maxHeight = window.innerHeight * 0.85;
    if (canvasHeight > maxHeight) {
      canvasHeight = maxHeight;
      canvasWidth = canvasHeight / ASPECT_RATIO;
    }
    
    console.log(`DESKTOP CANVAS: ${Math.round(canvasWidth)}x${Math.round(canvasHeight)}`);
  } else {
    // MOBILE: Keep existing responsive behavior
    const bodyWidth = document.body.clientWidth;
    canvasWidth = Math.min(containerWidth, bodyWidth * 0.95);
    canvasWidth = Math.max(canvasWidth, 280); // Minimum usable size
    canvasHeight = canvasWidth * ASPECT_RATIO;
    
    // Check if height exceeds window height
    const maxHeight = window.innerHeight * 0.7;
    if (canvasHeight > maxHeight) {
      canvasHeight = maxHeight;
      canvasWidth = canvasHeight / ASPECT_RATIO;
    }
  }
  
  // Set both CSS and actual canvas dimensions
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  
  // Calculate scaling factors for game elements
  SCALE_FACTOR = canvasWidth / BASE_CANVAS_WIDTH;
  
  // Update scale factor related values
  console.log(`Canvas dimensions: ${Math.round(canvasWidth)}x${Math.round(canvasHeight)} (Scale: ${SCALE_FACTOR.toFixed(2)})`);
  
  return {
    widthScale: canvasWidth / BASE_CANVAS_WIDTH,
    heightScale: canvasHeight / BASE_CANVAS_HEIGHT,
    pixelRatio: window.devicePixelRatio || 1,
    reducedResolution: false // Default value, can be updated by ResponsiveManager
  };
}

/**
 * Checks if two rectangles are colliding
 * @param rect1 - First rectangle
 * @param rect2 - Second rectangle
 * @returns Whether the rectangles are colliding
 */
export function checkCollision(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

/**
 * Debounces a function call
 * @param func - The function to debounce
 * @param wait - The time to wait in milliseconds
 * @returns A debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T, 
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = window.setTimeout(later, wait);
  };
}
