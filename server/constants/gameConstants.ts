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
  WIDTH: 4200, // big enough for 12-15x giants to roam, filled to match (gems, bots, showers)
  HEIGHT: 4200,
  VIEW_AREA: 720000,
  MIN_VIEW_ASPECT: 0.6,
  MAX_VIEW_ASPECT: 1.8,
  /** Small players see a closer view and big ones see farther: a newborn's view is VIEW_ZOOM_SMALL of
   * the width VIEW_AREA gives, widening with (width / newborn width) ^ VIEW_GROWTH, less than you
   * grow, so a giant still fills a good part of the screen (about a sixth of its height at 12x) */
  VIEW_ZOOM_SMALL: 0.8,
  VIEW_GROWTH: 0.15, // (much less than you grow: a giant fills its own screen)
  VIEW_ZOOM_MAX: 1.5, // and never zoomed out past this, so a huge creature looms like a boss on everyone's screen
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
  FIELD_COUNT: 240, // loose gems lying around the world
  RADIUS: 9,
  /**
   * Size = PLAYER_SIZE + this x the square root of your gems, with no ceiling: area grows with gems,
   * like Agar.io. 45 wide at 10 gems, 100 at 100 (5x a newborn), 240 at 750 (12x), 300 at 1,200 (15x).
   * Shedding (DECAY_*) slows growth down instead of stopping it.
   */
  BASE_MASS: 2, // width = PLAYER_SIZE x sqrt(1 + gems / this) (a newborn's body counts as this many gems): every gem grows you, gently at first (24.5 wide with 1 gem), 7x a newborn at 100, 14x at 400
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
  DECAY_START: 100, // above this many gems you slowly shed them...
  DECAY_RATE: 0.0025, // ...this share of what's above DECAY_START each second (1.6 a second at 750, 2.7 at 1,200)
  MAX_GEMS: 1400, // cap on gems in the world at once
} as const;

/**
 * Knockback from blasts and hits. Creatures never shove each other: touching just stops you (see
 * GameState.keepApart). Weight grows with size, so heavier creatures slide less.
 */
export const PUSH = {
  DISTANCE: 140, // how far a shove sends someone your own weight (about two hops)...
  MIN_RATIO: 0.3, // ...scaled by your weight over theirs, kept within these limits
  MAX_RATIO: 3,
  FRICTION: 7, // shoved players slow by this factor a second (about half a second of sliding)
  STOP_SPEED: 40, // units per second; slower than this and the slide is over
  SAME_SHOVER_COOLDOWN_MS: 300, // one shove per hop, not one per frame of contact
  HIT_IMMUNITY_MS: 1500, // after losing gems to a hit, nothing can knock more loose for this long
  SKID_BODY_LENGTHS: 2, // a hit that costs gems sends you skidding this many of your own sizes...
  SKID_MIN: 60, // ...and at least this far
} as const;

/**
 * Bots keep a quiet world lively. They hop by the same rules as people (so they're never
 * faster), dodge the traffic they see coming, chase gems and shove now and then.
 */
export const BOTS = {
  FILL_TO: 11, // bots fill in until this many are playing, and leave as people arrive
  NAMES: ["Bolt", "Pixel", "Zippy", "Nova", "Sprocket", "Blip", "Widget", "Gizmo", "Rivet", "Chip", "Pebble", "Comet", "Fizz", "Mochi", "Dot"],
  THINK_MS_MIN: 200, // each bot decides on a hop every 200-320 ms (it varies by bot)...
  THINK_MS_MAX: 320,
  LOOK_AHEAD: 0.7, // ...watching the next 0.7 seconds of traffic...
  SAFETY_MARGIN: 10, // ...and keeping this far clear of it
  MISTAKE_CHANCE: 0.07, // how often a bot hops at random instead (varies by bot, up to 1.5x this)
  MAX_AGGRESSION: 0.35, // how keen the keenest bot is to shove whoever is next to it
  HUNT_RANGE: 700, // bots go after creatures they can rob or swallow within about this far (more for bolder bots)...
  GEM_SIGHT: 1000, // bots go for gems within this distance...
  FLEE_RATIO: 1.5, // bots run from anyone this many times their size who comes within FLEE_RANGE
  FLEE_RANGE: 420, // (a giant's inhale reaches about 400)
  CONTENT_AT: 30, // ...until they have this many; then they just wander, dodge and shove
  DECAY_START: 20, // bots shed gems above this, and faster (people: GEMS.DECAY_*), so people can outgrow them...
  DECAY_RATE: 0.02, // ...this share of what's above DECAY_START each second (1 a second at 70)
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

/**
 * Which way creatures face (where the mouth and its inhale point; you still walk wherever you
 * steer). Turning is like turning a real body: heavier creatures turn slower at most, and are slow
 * to start turning and slow to stop (see turnStep), and anyone inhaling turns slower still, so a
 * cone can't be whipped round onto someone circling you.
 */
export const FACING = {
  TURN_RATE: 5.5, // radians a second at most for a newborn...
  TURN_FALLOFF: 0.5, // ...falling as (PLAYER_SIZE / width) ^ this: about 2.8 at 25 gems, 2 at 100, 1.4 at 400
  INHALE_TURN: 0.4, // ...and while inhaling, this share of that
  TURN_ACCEL: 30, // how fast turning builds up or slows down (radians a second, each second) for a newborn...
  ACCEL_FALLOFF: 1, // ...falling as (PLAYER_SIZE / width) ^ this: a giant takes a while to get turning, and to stop
} as const;

/**
 * How hard suction moves a body (a creature's inhale, or a turbine's intake): the puller's width
 * over the target's, softened by SOFTEN and kept between MIN and MAX. Small creatures are moved
 * strongly, giants barely. Bodies only: gems have their own rule (see INHALE.STEAL_RATE).
 */
export const SUCTION = {
  SOFTEN: 0.75,
  MIN: 0.3,
  MAX: 2,
} as const;

/**
 * Inhaling, the one button: everything in a cone in front of your mouth (longer the bigger you
 * are). Gems are pulled in and swallowed. Every creature in it is robbed of gems (STEAL_RATE) and
 * pulled bodily toward your mouth, by mass: harder the heavier you are next to it, the closer it is
 * and the more squarely in front (BODY_PULL). One 1.3 times narrower or more (EAT_RATIO)
 * goes down once it's held right at your mouth for GULP_MS. Size resists being pulled, not being
 * robbed; heavier creatures move and turn slower.
 */
export const INHALE = {
  REACH: 80, // plus REACH_PER_SIZE times your width: 120 for a newborn, about 365 at 100 gems, 650 at 400 (the cone on screen is exactly this long)
  REACH_PER_SIZE: 2,
  ARC: 35, // degrees either side of where you face
  PULL_GEMS: 520, // units a second
  PULL_BOMBS: 420,
  BODY_PULL: 110, // units a second a creature your own size is pulled at, dead ahead (it builds up: see LOCK_MS)...
  BODY_PULL_MAX: 3, // ...times your width over its (mass, with pull and resistance each growing as the square root of mass), up to this...
  PREY_PULL_CAP: 0.9, // ...but never more than this share of its own top speed: break the cone (turn, strafe) and it can get away
  EAT_RATIO: 1.3, // you can swallow a creature 1.3 times narrower (about 1.7 times lighter)...
  GULP_REACH: 0.35, // ...held this close to your mouth (times your width, plus its radius)...
  GULP_MS: 400, // ...once it's held right at your mouth for this long (if it gets away first, it starts over)
  LOCK_MS: 1500, // holding a creature in your inhale builds a lock to full over this long...
  LOCK_DECAY_MS: 350, // ...that fades this fast once it's out of the cone (or you stop), so breaking the cone frees it
  LOCK_START: 0.25, // body pull starts at this share and grows with the lock squared: a warning, then dangerous, then full
  // Held in your airflow without a break, gems come off more and more violently: by seconds held, the
  // drain multiplier (steps: 1x, then 1.5x from 0.4s, 2.5x from 0.8s, 4x from 1.2s, 6x from 1.6s, 8x from 2s on)
  DRAIN_RAMP: [
    [0, 1],
    [0.4, 1.5],
    [0.8, 2.5],
    [1.2, 4],
    [1.6, 6],
    [2.0, 8],
  ],
  HOLD_DECAY: 6, // ...and out of the airflow, the time held drains away this many times faster than it built (2s is gone in a third of a second)
  CLOSE_RANGE: 0.25, // the share of the reach nearest the mouth where the pull gets much stronger...
  CLOSE_BOOST: 1.5, // ...up to this much more on top: caught close to the mouth of someone bigger, you're probably done
  MAX_MS: 5000, // a full breath lasts this long while you inhale (time to build a lock and drag someone in)...
  REFILL_MS: 3000, // ...and refills from empty in this long, starting from wherever it is (a short puff costs a short wait)
  MIN_BREATH: 0.1, // you can start inhaling with at least this share of a breath
  STEAL_RATE: 10, // gems a second pulled out of a creature in your inhale (shared out, weaker farther out or while it gets away), whatever either one's size
  STEAL_EDGE_SHARE: 0.25, // everyone in an inhale is robbed, sharing its drain by how squarely they sit in the cone: dead center counts 1, the very edge this
  STEAL_FALLOFF: 1, // drain fades evenly from the mouth to the tip of the cone, just as the cone fades on screen
  STEAL_ESCAPE: 0.75, // getting away cuts the drain by up to this much...
  STEAL_ESCAPE_AWAY: 0.6, // ...counting speed straight away at this share, and speed across the cone in full (strafing escapes best)...
  STEAL_POINT_BLANK: 0.25, // ...but less and less within this share of the reach: right at the mouth there's no getting away
  STOLE_NOTICE: 5, // a theft this big gets a banner and a line in the feed
} as const;

/**
 * Bombs lie around the arena. Inhale one and it's safe in your mouth for as long as you like. Tap to
 * spit it: it slides, slows to a stop and bounces off walls, and its fuse starts. When it goes off,
 * everyone within BLAST_RADIUS is knocked outward (lighter creatures farther) and has gems knocked
 * loose (more near the middle); under GEMS.SURVIVE_AT gems it knocks you out. Other bombs in the
 * blast go off too. Anyone can nudge a bomb by walking into it. A lit bomb
 * can still be inhaled, but its fuse keeps ticking. A bomb that has gone off turns up somewhere else.
 */
export const BOMBS = {
  ENABLED: false, // switched off while inhale-only combat is tested (the smoke test switches them on in its world)
  COUNT: 6,
  RADIUS: 15,
  SPIT_SPEED: 620,
  FRICTION: 2.3, // how fast a sliding bomb slows (it slides about SPIT_SPEED / FRICTION units)
  FUSE_MS: 2200,
  CHAIN_MS: 150, // a bomb caught in a blast goes off this soon after
  BLAST_RADIUS: 150,
  PUSH_MIN: 160, // knockback at the blast's edge...
  PUSH_MAX: 380, // ...and at its middle (lighter creatures fly farther)
  SHARE_MIN: 0.08, // share of gems knocked loose at the edge...
  SHARE_MAX: 0.25, // ...and at the middle
  LOOSE_MAX: 30,
  RESPAWN_MS: 6000,
  SPIT_COOLDOWN_MS: 400,
} as const;

export const SHIFT = {
  GRID: 10, // shapes are drawn on a 10x10 grid of tiles (420 units each)
  FIRST_AFTER_MS: 90000, // the first shift comes this long after a world starts...
  EVERY_MS: 150000, // ...then this long after the arena returns
  GRACE_MS: 8000, // the new shape is shown, and nobody can be hurt while they get onto it
  SHIFT_MS: 45000, // then the rest drops away for this long, and the whole arena returns
  FLOOR_SHARE_MIN: 0.35, // the floor covers 35-65% of the arena...
  FLOOR_SHARE_MAX: 0.65,
  BASE_SHARE: 0.42, // ...about this much with six players, growing slower than the player count
  MAX_REACH_TILES: 5, // every spot is within this many tiles of the new floor
  CANDIDATES: 6, // shapes tried each time; the best one is used
  GRACE_GEMS: 48, // gems that drop onto the new floor during the grace period
  SHOWER_EVERY_MS: 4000, // gem showers during the shift, richer as it goes on
  SHOWER_GEMS: 24,
  DROP_MS: 800, // a dropping gem can't be picked up until it lands
  JACKPOT_VALUE: 40,
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
/**
 * Turbines: machines that pop up around the arena for a minute or so, then move. The intake (it
 * never turns) pulls in loose gems and nearby players, and rips gems out of anyone in its inner
 * zone, one by one; each flies in, crosses the turbine and fires out of the exhaust, which sweeps
 * slowly back and forth across the far side, landing 400-700 units away as an ordinary gem. The
 * exhaust's wind pushes players too, small ones most. Gems are moved around, never lost.
 */
export const TURBINE = {
  ENABLED: true,
  COUNT: 3, // how many there are at once
  BODY_RADIUS: 60, // the turbine itself is solid
  INTAKE_REACH: 520, // how far in front of the intake its suction reaches...
  INTAKE_ARC: 0.7, // ...within this angle (radians) either side of where it points
  DANGER_REACH: 190, // anyone this close to the intake (edge to edge) has gems ripped out of them...
  STRIP_RATE: 3, // ...this many a second...
  STRIP_PER_ROOT: 1.5, // ...plus this times the square root of their weight (giants lose them fastest)
  GEM_PULL: 480, // units a second loose gems are pulled at near the intake (a quarter of that at the edge)
  PLAYER_PULL: 120, // units a second players are pulled at right by the intake (times SUCTION), easing to nothing at the edge...
  SUCTION_SIZE: 60, // ...as if by a creature this wide (newborns are dragged hard, giants can walk away)
  TRAVEL_SPEED: 700, // units a second a stolen gem flies into the intake...
  MIN_TRAVEL_MS: 200,
  INSIDE_MS: 450, // ...then it crosses the turbine...
  EXHAUST_SPEED_MIN: 1050, // ...and fires out of the exhaust this fast (it travels about 400-700 units)
  EXHAUST_SPEED_MAX: 1780,
  EXHAUST_SPREAD: 0.08, // radians either side of the exhaust's direction
  LAUNCH_STOP_SPEED: 30, // a fired gem settles below this speed
  EXHAUST_SWEEP: Math.PI, // the exhaust sweeps across this angle (centered opposite the intake)...
  EXHAUST_CYCLE_MS: 10000, // ...left, right and back again this often
  EXHAUST_REACH: 650, // its wind reaches this far...
  EXHAUST_ARC: 0.38, // ...within this angle either side of where it points...
  WIND: 360, // ...pushing a newborn this fast right at the nozzle (divided by the square root of weight), easing to nothing at the end
  WARNING_MS: 3000, // a new turbine shows where it's coming for this long before it switches on...
  LIFE_MIN_MS: 60000, // ...runs this long...
  LIFE_MAX_MS: 90000,
  POWER_DOWN_MS: 2000, // ...powers down (finishing the gems already inside)...
  RESPAWN_MIN_MS: 3000, // ...and comes back somewhere else this much later
  RESPAWN_MAX_MS: 7000,
  EDGE_MARGIN: 600, // never this close to the world's edge,
  SPACING: 1300, // another turbine,
  PLAYER_CLEARANCE: 450, // or a player
} as const;

export const ARENA_RULES = {
  PLAYER_SIZE: 20, // a new player's size; gems make you bigger (GEMS.BASE_MASS)
  HOP: 60, // one tap = one hop, while you're small...
  HOP_BEYOND_SIZE: 12, // ...and once you're big, your size plus this, so a hop always clears you
  MOVE_SPEED: 320, // top speed (units a second) for a newborn...
  SPEED_FALLOFF: 0.7, // ...falling smoothly as MOVE_SPEED x (PLAYER_SIZE / width) ^ this, with every gem: about 275 with 1 gem, 205 with 5, 130 with 25, 80 with 100, 50 with 400
  MIN_SPEED: 0, // no floor: the bigger you get, the slower you go (raise this to bring a floor back)
  MOVE_RESPONSE: 14, // how quickly you reach the speed you're steering (and glide to a stop)
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
  FACING,
  INHALE,
  BOMBS,
  TURBINE,
  SUCTION,
  SHIFT,
  KEYS,
  DEVICE_SETTINGS
} as const;

// Export everything as default for legacy imports
export default GAME_CONSTANTS;
