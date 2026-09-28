/**
 * Server-specific constants for the game server
 * Imports base constants and adds server-specific values
 */

import { 
  GAME_CONSTANTS, 
  PLAYER, 
  OBSTACLE, 
  GAME, 
  STATE, 
  PLAYER_STATE, 
  WORLD,
  PLAYER_COLORS 
} from './gameConstants.js';

// Server-specific settings
export const SERVER = {
  DEFAULT_PORT: 3000,
  PING_INTERVAL: 5000,
  PING_MAX_RETRIES: 3,
  MONITOR_PATH: '/colyseus',
};

// Connection and network settings
export const NETWORK = {
  MAX_MESSAGE_SIZE: 1024 * 10, // 10kb
  MESSAGE_TIMEOUT: 10000, // 10 seconds
};

// Re-export all constants for convenience
export {
  GAME_CONSTANTS,
  PLAYER,
  OBSTACLE,
  GAME,
  STATE,
  PLAYER_STATE,
  WORLD,
  PLAYER_COLORS
};
