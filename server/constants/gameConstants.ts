/**
 * Unified game constants shared between client and server
 * This file serves as the single source of truth for all game constants
 */

// Canvas defaults - improved aspect ratio
export const CANVAS = {
  BASE_WIDTH: 600,
  BASE_HEIGHT: 700,
  MAX_DESKTOP_WIDTH: 1600,  // Increased maximum width for desktop (especially for large monitors)
  MAX_MOBILE_WIDTH: 800     // Maximum width for mobile
};

// Player settings
export const PLAYER = {
  BASE_WIDTH: 30,
  BASE_HEIGHT: 30,
  MIN_STEP: 3,
  BASE_SPEED: 5,
  SIZE_RATIO: 0.04,
} as const;

// Obstacle settings
export const OBSTACLE = {
  BASE_SPEED: 2,
  MIN_WIDTH: 30,
  MAX_WIDTH: 60,
  MIN_WIDTH_RATIO: 0.08,
  MAX_WIDTH_RATIO: 0.18,
} as const;

// Projectile settings
export const PROJECTILE = {
  WIDTH: 4,
  HEIGHT: 8,
  SPEED: 400,
  BASE_SPEED: 400, // Base speed for projectiles (used in constructor)
  MAX_ACTIVE: 5,
  MAX_COUNT: 5, // Maximum number of projectiles (used by ProjectileManager)
  FIRE_RATE: 250, // milliseconds between shots
  COLOR: '#00ffff',
  TRAIL_LENGTH: 3,
  LIFETIME: 3000, // Projectile lifetime in milliseconds (3 seconds)
} as const;

// Game settings
export const GAME = {
  WINNING_LINE: 40,
  MAX_PLAYERS: 30,
  STATE_UPDATE_RATE: 1000 / 30, // 30 updates per second
  ROOM_NAME: "game_room",
  MAX_OBSTACLES: 12,
  DIFFICULTY_INCREASE_RATE: 0.15,
} as const;

// Game states
export const STATE = {
  READY: 'ready',
  WAITING: "waiting",
  STARTING: "starting",
  PLAYING: "playing",
  GAME_OVER: "game_over",
  PAUSED: "paused",
} as const;

// Player states
export const PLAYER_STATE = {
  ALIVE: "alive",
  DEAD: "dead",
  SPECTATING: "spectating",
} as const;

// Arena settings
export const ARENA = {
  INITIAL_AREA_PERCENTAGE: 100,
  SHRINK_INTERVAL: 30000, // 30 seconds between shrinks
  SHRINK_PERCENTAGE: 10, // Shrink by 10% each time
  MIN_AREA_PERCENTAGE: 40, // Don't shrink below 40% of original size
} as const;

// Key mappings
export const KEYS = {
  UP: ['ArrowUp', 'Up', 'w', 'W'],
  DOWN: ['ArrowDown', 'Down', 's', 'S'],
  LEFT: ['ArrowLeft', 'Left', 'a', 'A'],
  RIGHT: ['ArrowRight', 'Right', 'd', 'D'],
  RESTART: ['r', 'R'],
  SHOOT: [' ', 'Space', 'Enter'], // Spacebar, Space, and Enter
} as const;

// Player colors for differentiation - improved contrast with dark background
export const PLAYER_COLORS = [
  "#FF5252", // Red
  "#FF9800", // Orange
  "#FFEB3B", // Yellow
  "#4CAF50", // Green
  "#00BCD4", // Cyan
  "#64FFDA", // Mint
  "#E91E63", // Pink
  "#3F51B5", // Indigo
  "#00E5FF", // Light Cyan
  "#76FF03", // Bright Green
  "#FFC400", // Amber
  "#F50057", // Pink
  "#D500F9", // Purple
  "#00B0FF", // Light Blue
  "#F44336", // Red (darker)
  "#FF5722", // Deep Orange
  "#651FFF", // Deep Purple
  "#2979FF", // Bright Blue
  "#18FFFF", // Aqua
  "#1DE9B6", // Teal
  "#00E676", // Green
  "#C6FF00", // Lime
  "#FFC107", // Amber
  "#FF3D00", // Deep Orange
  "#FF9100", // Orange
  "#FFEA00", // Yellow
  "#76FF03"  // Lime
] as const;

// Device-specific settings - improved for better game feel
export const DEVICE_SETTINGS = {
  // Desktop settings
  DESKTOP: {
    PLAYER_SIZE_RATIO: 0.035,
    MIN_STEP: 10,
    OBSTACLE_MIN_WIDTH_RATIO: 0.08,
    OBSTACLE_MAX_WIDTH_RATIO: 0.18,
    BASE_SPEED: 3.5,
    DIFFICULTY_INCREASE_RATE: 0.18
  },
  // Mobile settings 
  MOBILE: {
    PLAYER_SIZE_RATIO: 0.045,
    MIN_STEP: 4,
    OBSTACLE_MIN_WIDTH_RATIO: 0.1,
    OBSTACLE_MAX_WIDTH_RATIO: 0.2,
    BASE_SPEED: 2.5,
    DIFFICULTY_INCREASE_RATE: 0.15
  }
} as const;

// Export desktop settings directly for backward compatibility
export const DESKTOP_SETTINGS = DEVICE_SETTINGS.DESKTOP;

// Bundle all constants for convenient access
export const GAME_CONSTANTS = {
  CANVAS,
  PLAYER,
  OBSTACLE,
  PROJECTILE, // Added this
  GAME,
  STATE,
  PLAYER_STATE,
  ARENA,
  KEYS,
  DEVICE_SETTINGS
} as const;

// Export everything as default for legacy imports
export default GAME_CONSTANTS;
