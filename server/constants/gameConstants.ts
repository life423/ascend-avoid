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
  OBSTACLE_COUNT: 6, // lane traffic (comets and balls cross it at other angles); open space to fight and charge in
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
  MAX_SIZE: 100, // ...up to this...
  MAX_HELD: 178, // ...which you reach at this many gems. Like Agar.io, that is the cap: a full-size player picks up no more (the gems stay for others)
  SPRAY_SHARE: 0.5, // a hit sprays out this share of your gems...
  SURVIVE_AT: 3, // ...but with fewer than this, a hit knocks you out (your last gems burst out)
  SPRAY_PIECES: 24, // at most this many gems fly out; big piles make bigger gems
  SPRAY_SPEED_MIN: 260, // units per second...
  SPRAY_SPEED_MAX: 520,
  SPRAY_FRICTION: 2.5, // ...slowing by this factor a second, so they travel about 100-200 units
  SPRAY_PICKUP_DELAY_MS: 350, // they fly out before anyone can grab them
  SPRAY_LIFETIME_MS: 15000, // uncollected sprayed gems vanish
  HIT_RECOVERY_MS: 800, // after a hit you skid and blink: traffic passes through you and you can't hop
  OWNER_PICKUP_DELAY_MS: 1500, // your own spilled gems wait this long for you, so whoever caused it gets first crack
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
  /**
   * Body-checks: a clearly bigger player moving into a smaller one (toward them at BODY_CHECK_SPEED
   * of their top speed or more, or dashing) shoves them hard and spills their gems, by how much
   * bigger they are (width over width, biggest tier first). At BODY_CHECK_KO_AT and up, a victim
   * under GEMS.SURVIVE_AT gems is knocked out. Same immunity as a slingshot hit.
   */
  BODY_CHECK_TIERS: [
    { at: 2, shove: 300, spill: 0.25 },
    { at: 1.5, shove: 220, spill: 0.12 },
    { at: 1.25, shove: 160, spill: 0 }, // just a harder shove
  ],
  BODY_CHECK_SPEED: 0.5,
  BODY_CHECK_KO_AT: 2,
  BODY_CHECK_MAX_SPILL: 20,
  LEADER_BOUNTY_SHARE: 0.1, // shoving the leader knocks this share of their gems loose...
  LEADER_BOUNTY_MIN: 2,
  LEADER_BOUNTY_MAX: 8,
  LEADER_BOUNTY_COOLDOWN_MS: 1500, // ...at most this often
  SLING_PUSH_MIN: 280, // a slingshot hit shoves this far at the least charge...
  SLING_PUSH_MAX: 520, // ...and this far at full...
  SLING_WEIGHT_POWER: 0.2, // ...with weight counting only a little (the small player's equalizer)...
  SLING_WEIGHT_MIN: 0.6, // ...within these limits
  SLING_WEIGHT_MAX: 1.25,
  KNOCK_SHARE_SLING_MIN: 0.12, // a slingshot hit knocks this share loose at the least charge...
  KNOCK_SHARE_SLING_MAX: 0.25, // ...and this share at full...
  KNOCK_MAX_SLING: 20, // ...up to this many (a dash hit knocks none: it only shoves)...
  KNOCK_SIZE_MIN: 0.75, // ...scaled a little by size: the square root of attacker over target weight, within these limits
  KNOCK_SIZE_MAX: 1.3,
  SKID_BODY_LENGTHS: 2, // a hit that costs gems sends you skidding this many of your own sizes...
  SKID_MIN: 60, // ...and at least this far
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
  SLING_CHANCE: 0.12, // chance a bot charges a slingshot at whoever it's hunting, when they're 150-400 away
  FLEE_RATIO: 1.5, // bots run from anyone this many times their size who comes within FLEE_RANGE
  FLEE_RANGE: 260,
  DASH_REACH: 70, // bots dash into whoever they're hunting once this close (gap between them)
  CONTENT_AT: 30, // ...until they have this many; then they just wander, dodge and shove
  DECAY_START: 20, // bots shed gems above this (people above GEMS.DECAY_START), so people can outgrow them
} as const;

/**
 * The arena shift: every few minutes the floor reshapes. The new shape is shown first, with a
 * grace period in which nobody can be hurt; then the rest of the arena drops away into a void
 * (going over the edge counts as a hit) until the whole arena returns.
 */
/**
 * Traffic runs in lanes, Frogger-style: 14 across and 14 down, each with its own direction and
 * speed (reshuffled at every arena shift). Obstacles in a lane keep a gap wider than the biggest
 * player, and lanes side by side are staggered, so traffic never lines up into a wall.
 */
export const TRAFFIC = {
  /**
   * Traffic is switched off: live worlds have no lane traffic, comets or balls, so the danger comes
   * from other players and the void during arena shifts. The code stays, dormant, so this one line
   * brings it back (the automated test still switches it on in its own world to keep it working).
   */
  ENABLED: false,
  LANES: 14, // in each direction (across and down), so lanes are 150 units apart
  MIN_GAP: 220, // between obstacles in the same lane
  STAGGER: 150, // between an entering obstacle and those in the lanes beside it
  /**
   * Traffic comes in waves: between them the arena is calm (no lane traffic, comets or balls).
   * Every WAVE_GAP_MIN_MS to WAVE_GAP_MAX_MS a chip warns "Traffic incoming" for WAVE_WARNING_MS,
   * then everything streams in for WAVE_MS and leaves on its own. Never alongside an arena shift.
   */
  WAVE_GAP_MIN_MS: 60000,
  WAVE_GAP_MAX_MS: 180000,
  WAVE_WARNING_MS: 3000,
  WAVE_MS: 25000,
  WAVE_SHIFT_MARGIN_MS: 5000, // a wave waits if it would end within this long of a shift starting
} as const;

/** Round hazards that roll diagonally and bounce off the arena's walls, cutting across the lanes */
export const BALLS = {
  COUNT: 3,
  RADIUS: 24,
  SPEED: 170, // units per second
} as const;

/**
 * Comets fly in from the edges at a slant (never along the traffic lanes), so the gaps between
 * lane traffic keep moving. The first STRAIGHT fly straight; the next CURVED bend gently, a few
 * degrees over a whole crossing. Readable, never random.
 */
export const COMETS = {
  STRAIGHT: 3,
  CURVED: 2,
  RADIUS: 20,
  SPEED_MIN: 200, // units per second
  SPEED_MAX: 270,
  MIN_SLANT: 25, // degrees off straight in from the edge...
  MAX_SLANT: 65, // ...so always well off the lanes' axes
  CURVE_MIN: 20, // degrees a curving comet bends over a whole crossing
  CURVE_MAX: 30,
} as const;

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
  MOVE_SPEED: 320, // top speed (units a second) for the smallest player...
  MOVE_SPEED_BIG: 250, // ...and for the biggest
  MOVE_RESPONSE: 14, // how quickly you reach the speed you're steering (and glide to a stop)
  DASH_SPEED: 900, // a dash is a burst at this speed...
  DASH_MS: 200, // ...for this long (about 180 units)...
  CHARGE_AFTER_MS: 400, // holding DASH this long turns it into a slingshot charge (you stand still)...
  CHARGE_FULL_MS: 1000, // ...full power this much later...
  SLING_MIN: 250, // ...launching you this far at the least charge...
  SLING_MAX: 500, // ...and this far at full, flying over the void as you go
  SLING_SPEED: 1100, // units a second in flight
  SLING_COOLDOWN_MS: 4000,
  SLING_COST: 2, // gems a slingshot costs...
  SLING_COST_BIG: 3, // ...or this many once you hold SLING_COST_BIG_AT
  SLING_COST_BIG_AT: 50,
  DASH_COOLDOWN_MS: 1000, // ...then needs this long to recharge...
  DASH_COST: 1, // ...and costs this many gems (if you have any)
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
  TRAFFIC,
  BALLS,
  COMETS,
  SHIFT,
  KEYS,
  DEVICE_SETTINGS
} as const;

// Export everything as default for legacy imports
export default GAME_CONSTANTS;
