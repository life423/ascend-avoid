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

/**
 * The online world: one big open arena several screens across. The camera follows each player
 * and every screen sees the same amount of it (VIEW_AREA, in square units), shaped to the screen
 * within the aspect limits, so a bigger monitor doesn't see more.
 */
export const WORLD = {
  WIDTH: 2100,
  HEIGHT: 2100,
  VIEW_AREA: 720000,
  MIN_VIEW_ASPECT: 0.6,
  MAX_VIEW_ASPECT: 1.8,
  /** Small players see a closer view and big ones see farther: the view's width at the
   * smallest size and at the biggest, as a share of the view VIEW_AREA gives */
  VIEW_ZOOM_SMALL: 0.8,
  VIEW_ZOOM_BIG: 1.3,
  OBSTACLE_COUNT: 36,
  RESPAWN_DELAY_MS: 2000,
  SPAWN_PROTECTION_MS: 1500,
  /** A respawn spot this far from all traffic is good enough */
  SPAWN_CLEARANCE: 220,
} as const;

/**
 * Gems: score and weight. They lie around the world, burst out of players who get hit, and make
 * you bigger, with longer hops and a slower rhythm when holding a direction.
 */
export const GEMS = {
  FIELD_COUNT: 60, // loose gems lying around the world
  RADIUS: 9,
  SIZE_PER_ROOT: 6, // size = PLAYER_SIZE + this x the square root of your gems (26 at 1 gem, 80 at 100)...
  MAX_SIZE: 100, // ...up to this
  SPRAY_SHARE: 0.5, // a hit sprays out this share of your gems
  SPRAY_PIECES: 24, // at most this many gems fly out; big piles make bigger gems
  SPRAY_SPEED_MIN: 260, // units per second...
  SPRAY_SPEED_MAX: 520,
  SPRAY_FRICTION: 2.5, // ...slowing by this factor a second, so they travel about 100-200 units
  SPRAY_PICKUP_DELAY_MS: 350, // they fly out before anyone can grab them
  SPRAY_LIFETIME_MS: 15000, // uncollected sprayed gems vanish
  HIT_RECOVERY_MS: 1000, // after a hit, traffic passes through you for this long
  DECAY_START: 50, // above this many gems you slowly shed them (one a second at twice this)
  MAX_GEMS: 300, // cap on gems in the world at once
} as const;

/**
 * Shoving: hop into someone and they slide away. Weight grows with size (1 to 2.25), so heavier
 * players shove harder and are harder to shove.
 */
export const PUSH = {
  DISTANCE: 140, // how far a shove sends someone your own weight (about two hops)...
  MIN_RATIO: 0.3, // ...scaled by your weight over theirs, kept within these limits
  MAX_RATIO: 3,
  FRICTION: 7, // shoved players slow by this factor a second (about half a second of sliding)
  STOP_SPEED: 40, // units per second; slower than this and the slide is over
  SAME_SHOVER_COOLDOWN_MS: 300, // one shove per hop, not one per frame of contact
  LEADER_BOUNTY_SHARE: 0.1, // shoving the leader knocks this share of their gems loose...
  LEADER_BOUNTY_MIN: 2,
  LEADER_BOUNTY_MAX: 8,
  LEADER_BOUNTY_COOLDOWN_MS: 1500, // ...at most this often
} as const;

/**
 * Bots keep a quiet world lively. They hop by the same rules as people (so they're never
 * faster), dodge the traffic they see coming, chase gems and shove now and then.
 */
export const BOTS = {
  FILL_TO: 6, // bots fill in until this many are playing, and leave as people arrive
  NAMES: ["Bolt", "Pixel", "Zippy", "Nova", "Sprocket", "Blip", "Widget", "Gizmo", "Rivet", "Chip"],
  THINK_MS_MIN: 200, // each bot decides on a hop every 200-320 ms (it varies by bot)...
  THINK_MS_MAX: 320,
  LOOK_AHEAD: 0.7, // ...watching the next 0.7 seconds of traffic...
  SAFETY_MARGIN: 10, // ...and keeping this far clear of it
  MISTAKE_CHANCE: 0.07, // how often a bot hops at random instead (varies by bot, up to 1.5x this)
  MAX_AGGRESSION: 0.35, // how keen the keenest bot is to shove whoever is next to it
  GEM_SIGHT: 700, // bots go for gems within this distance...
  CONTENT_AT: 30, // ...until they have this many; then they just wander, dodge and shove
  DECAY_START: 20, // bots shed gems above this (people above GEMS.DECAY_START), so people can outgrow them
} as const;

/**
 * The arena shift: every few minutes the floor reshapes. The new shape is shown first, with a
 * grace period in which nobody can be hurt; then the rest of the arena drops away into a void
 * (going over the edge counts as a hit) until the whole arena returns.
 */
export const SHIFT = {
  GRID: 10, // shapes are drawn on a 10x10 grid of tiles (210 units each)
  FIRST_AFTER_MS: 90000, // the first shift comes this long after a world starts...
  EVERY_MS: 150000, // ...then this long after the arena returns
  GRACE_MS: 8000, // the new shape is shown, and nobody can be hurt while they get onto it
  SHIFT_MS: 45000, // then the rest drops away for this long, and the whole arena returns
  FLOOR_SHARE_MIN: 0.35, // the floor covers 35-65% of the arena...
  FLOOR_SHARE_MAX: 0.65,
  BASE_SHARE: 0.42, // ...about this much with six players, growing slower than the player count
  MAX_REACH_TILES: 5, // every spot is within this many tiles of the new floor
  CANDIDATES: 6, // shapes tried each time; the best one is used
  GRACE_GEMS: 12, // gems that drop onto the new floor during the grace period
  SHOWER_EVERY_MS: 4000, // gem showers during the shift, richer as it goes on
  SHOWER_GEMS: 6,
  DROP_MS: 800, // a dropping gem can't be picked up until it lands
  JACKPOT_VALUE: 20,
  JACKPOT_DROPS_WITH_MS_LEFT: 12000,
  JACKPOT_CLAIM_MS: 600, // stand on it alone this long to claim it (a shove resets it; two on it stalls it)
  JACKPOT_RADIUS: 26,
  CREDIT_MS: 2500, // a hit or fall this soon after a shove is credited to the shover
} as const;

/**
 * Sizes and speeds in world units, matching solo play's feel. Solo measures in screen pixels (a
 * 30px player, ~39px hops, obstacles 22px thick moving 2.5-3.5px a frame); these are those at a
 * typical canvas scale of 0.65.
 */
export const ARENA_RULES = {
  PLAYER_SIZE: 20, // a new player's size; gems make you bigger (GEMS.SIZE_PER_ROOT)
  HOP: 60, // one tap = one hop, while you're small...
  HOP_BEYOND_SIZE: 12, // ...and once you're big, your size plus this, so a hop always clears you
  HOP_REPEAT_DELAY: 0.2, // holding a direction: the first repeat hop comes after this many seconds,
  HOP_REPEAT: 1 / 6, // then one every this many seconds (six a second)
  EDGE_MARGIN: 8, // closest you can get to the edge of the world
  OBSTACLE_THICKNESS: 34,
  OBSTACLE_MIN_LENGTH: 48,
  OBSTACLE_MAX_LENGTH: 108,
  OBSTACLE_SPEED: 270, // units per second; each obstacle varies by up to 20% either way
  HOP_COOLDOWN_MS: 60, // server-side limit per direction, far faster than anyone taps
  PLAYER_HIT_SHRINK: 0.1, // a hit needs this share of a player's size in overlap (on each side)...
  OBSTACLE_HIT_INSET: 2, // ...and this much with an obstacle's drawn shape
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
  ARENA_RULES,
  WORLD,
  GEMS,
  PUSH,
  BOTS,
  SHIFT,
  KEYS,
  DEVICE_SETTINGS
} as const;

// Export everything as default for legacy imports
export default GAME_CONSTANTS;
