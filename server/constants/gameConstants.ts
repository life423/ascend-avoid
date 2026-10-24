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
  MAX_PLAYERS: 48,
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
  GULPED: "gulped",
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
  FIELD_COUNT: 1270, // loose gems lying around the world (one every ~118 units in a 4200-wide arena; MAX_GEMS leaves room for sprays on top)
  RADIUS: 9,
  /**
   * Size = PLAYER_SIZE + this x the square root of your gems, with no ceiling: area grows with gems,
   * like Agar.io. 45 wide at 10 gems, 100 at 100 (5x a newborn), 240 at 750 (12x), 300 at 1,200 (15x).
   * Shedding (DECAY_*) slows growth down instead of stopping it.
   */
  BASE_MASS: 2, // width = PLAYER_SIZE x sqrt(1 + gems / this) (a newborn's body counts as this many gems): every gem grows you, gently at first (24.5 wide with 1 gem), 7x a newborn at 100, 14x at 400
  SPRAY_SHARE: 0.5, // a hit sprays out this share of your gems...
  SURVIVE_AT: 3, // ...but with fewer than this, a hit knocks you out (your last gems burst out)
  SPRAY_PIECES: 40, // at most this many gems fly out; big piles make bigger gems
  SPRAY_SPEED_MIN: 260, // units per second...
  SPRAY_SPEED_MAX: 520,
  SPRAY_FRICTION: 2.5, // ...slowing by this factor a second, so they travel about 100-200 units
  SPRAY_PICKUP_DELAY_MS: 350, // they fly out before anyone can grab them
  SPRAY_LIFETIME_MS: 15000, // uncollected sprayed gems vanish
  HIT_RECOVERY_MS: 800, // after a hit you skid and blink: traffic passes through you and you can't hop
  OWNER_PICKUP_DELAY_MS: 1500, // your own spilled gems wait this long for you, so whoever caused it gets first crack
  DECAY_START: 300, // gems above this slowly shed (late game: a strong player can hold about 1500, see CAMERA)
  DECAY_RATE: 0.001, // ...this share of the excess a second (about 1.2 a second at 1500)
  MAX_GEMS: 2000, // cap on gems in the world at once (the field, plus about 700 for sprays)
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
  FILL_TO: 20, // room to roam; bots yield their places to arriving people
  NAMES: ["Bolt", "Pixel", "Zippy", "Nova", "Sprocket", "Blip", "Widget", "Gizmo", "Rivet", "Chip", "Pebble", "Comet", "Fizz", "Mochi", "Dot", "Tangle", "Scoot", "Bubble", "Ziggy", "Pogo", "Nibble", "Quark", "Jinx", "Wisp", "Flick", "Dizzy", "Tumble", "Pip", "Zoom", "Waffle", "Sprout", "Gadget", "Fidget", "Noodle", "Sizzle", "Bumble", "Twig", "Pixie", "Rocket", "Dash"],
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
  CROWD_SPACE: 220,
  CROWD_PENALTY: 110,
  MAX_PURSUERS: 2,
  DISPERSE_NEIGHBORS: 3,
  DISPERSE_MS: 6000,
  PURSUIT_PENALTY: 0.6, // a creature other bots are already after appeals this much less per pursuer (a frenzy, not a dogpile)
  SPILL_CROWD_PENALTY: 0.8, // a gem within SPILL_CROWD_RANGE of where other bots are already heading appeals this much less per bot (a spill still draws a crowd, then it spreads out)
  SPILL_CROWD_RANGE: 260,
  HUNT_GIVE_UP_MS: 6000, // a chase that hasn't closed to inhale reach in this long is dropped...
  SHUN_MS: 5000, // ...and that creature left alone for this long
  FIGHT_BACK_RATIO: 1.1, // robbed, a bot inhales back only if it's this much wider than the robber (it would win the clash); otherwise it slips sideways out of the cone. It robs a wider creature only from behind
  MAX_ROBBERS: 2, // including this bot: at most two attackers per victim
  ESCAPE_EVERY_MS: 450,
  ESCAPE_READ_MS: 500, // bots take a moment to read their sequence after the daze
  ESCAPE_SKILL: 0.65,
  FIRE_RANGE: 1100, // holding someone, a bot looks for another creature within this far to fire them at...
  FIRE_AIM: 0.18, // ...and fires once its facing is within this many radians of it...
  FIRE_WAIT_MS: 1600, // ...or straight ahead after holding this long with nobody to aim at
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
  TURN_FALLOFF: 0.25,
  INHALE_TURN: 0.55,
  TURN_ACCEL: 30, // how fast turning builds up or slows down (radians a second, each second) for a newborn...
  ACCEL_FALLOFF: 0.35, // large bodies respond promptly while retaining a lower turn rate
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
 * is caught once it's held right at your mouth (see CANNON). Size resists being pulled, not being
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
  PREY_PULL_CAP: 0.9, // ...but never more than this share of its own top speed: react early, or slip out of the cone sideways, and it can get away...
  PREY_PULL_CLOSE: 1.6, // ...except in the close range of a mouth big enough to catch it, where the suction rises past its top speed, to this share at the mouth: running straight away from right in front of a bigger mouth, you're pulled in (sideways out of the cone still escapes)
  EAT_RATIO: 1.3, // you can catch a creature 1.3 times narrower (swallowing it takes CANNON.SWALLOW_RATIO) (about 1.7 times lighter)...
  GULP_REACH: 0.35, // ...held this close to your mouth (times your width, plus its radius)...
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
  CONTACT_GAP: 4, // a creature touching you (within this many units) anywhere across your front...
  CONTACT_ARC: 100, // ...up to this many degrees either side of where you face, is caught by your inhale with no aiming...
  CONTACT_WEIGHT: 0.85, // ...as firmly as one this squarely in the cone (once there's a gap, aiming matters again)
  STEAL_FALLOFF: 1, // drain fades evenly from the mouth to the tip of the cone, just as the cone fades on screen
  STEAL_ESCAPE: 0.75, // getting away cuts the drain by up to this much...
  STEAL_ESCAPE_AWAY: 0.6, // ...counting speed straight away at this share, and speed across the cone in full (strafing escapes best)...
  STEAL_POINT_BLANK: 0.25, // ...but less and less within this share of the reach: right at the mouth there's no getting away
  DRAIN_FLOOR: 1, // stealing never takes a creature's last gem: draining weakens, it never kills (an empty creature has nothing to take, and is fine)
  CLASH_MARGIN: 0.15, // two creatures inhaling each other never both siphon: only the stronger pull does, once it's ahead by this share (closer than that, whoever has held the other longer keeps the flow), so a clash has a winner, not an endless exchange
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

/**
 * Cores (experimental): heavy objects anywhere in the arena that inhales push around (see
 * game/corePhysics). Inhale only ever applies force; momentum, swings and tug-of-war come from the
 * physics. Never swallowed, by anyone. A hard enough hit stuns (no gems lost).
 */
export const CORE = {
  COUNT: 3, // how many are in a world
  RADIUS: 24, // physical size (drawn at this size too); small enough for a newborn to work with
  MASS: 3, // in newborns: a creature's mass is (its width / a newborn's) squared
  DRAG: 0.35, // momentum fades by this share a second (exponentially): half its speed in about 2s, so launches carry
  MAX_SPEED: 750, // the Core's own top speed, whoever moved it
  WALL_RESTITUTION: 0.6, // share of its speed kept bouncing off the arena's edge
  CORE_RESTITUTION: 0.8, // ...and off another Core
  REACH: 140, // a Core feels an inhale from this far from the mouth to its near edge...
  REACH_PER_SIZE: 2.5, // ...plus this times the inhaler's width (newborn 190, 5x 390, 10x 640)
  FALLOFF_POWER: 1.3, // pull fades with distance across that reach as (1 - distance / reach) ^ this
  SUCTION: 3000, // pull (divided by MASS for acceleration), times how much of the Core is in the airflow: a newborn close up, about 1000 a second each second (enough to drag it along at a run)...
  PULL_GROWTH: 0.4, // ...times (width / a newborn's) ^ this for bigger creatures...
  PULL_MAX: 2.5, // ...up to this
  NEAR_ARC: 150, // near the body the airflow wraps wider: its arc grows from the inhale's own toward this many degrees either side
  NEAR_SPAN: 4, // ...over this many times the falloff zone outside the equilibrium distance (a Core trailing beside you stays in your airflow)
  DEFLECT: 2.5, // near the body, the air the body blocks is turned to flow round it the way it was already going (toward the mouth): how readily (no target angle; nothing when dead ahead)
  NEAR_FIELD: 4500, // inside the equilibrium distance, compressed air pushes it back out this hard (times the same size factor)...
  RADIAL_DAMPING: 4, // ...and its motion toward or away from the body (only that) is damped this much a second there, so the push adds no energy
  SIDE_MULTIPLIER: 1.25, // equilibrium distance beside the body, as a multiple of (body radius + Core radius)...
  FRONT_MULTIPLIER: 1.7, // ...and in front of the mouth
  FALLOFF: 0.8, // the inward pull fades smoothly to nothing over this share of the equilibrium distance outside it
  STUN_MOMENTUM: 750, // a hit (MASS x the speed it comes at you) stuns from this momentum (250 a second)...
  STUN_FULL_MOMENTUM: 1950, // ...for longer up to this one (650 a second)
  STUN_MIN_MS: 300,
  STUN_MAX_MS: 850,
  STUN_IMMUNE_MS: 1200, // after a stun wears off, no more stuns for this long...
  SEPARATE: 6, // ...and a Core has to come away by this much before it can stun the same player again
  IMPACT_BOUNCE: 0.35, // how springy a Core is hitting a player (it loses speed, so it can't ricochet through everyone)
  SPAWN_CLEAR: 600, // spawned at least this far from any player...
  SPAWN_GAP: 1000, // ...from other Cores...
  SPAWN_TURBINE_GAP: 500, // ...and from turbines
  DEBUG: false, // development only: draw each Core's velocity, speed and equilibrium distances
} as const;

/**
 * Player airflow connections (see game/airflow): one airflow quality (0-1) from shared geometry
 * drives the soft latch, its gentle aim assist, the cone focusing into a stream, drain, the drain
 * ramp, swallowing and breath. Deep body overlap smothers the air: worse, not better.
 */
export const LATCH = {
  ACQUIRE_QUALITY: 0.3, // airflow this clean on a creature catches it (the latch)...
  KEEP_QUALITY: 0.12, // ...it holds while the airflow stays at least this clean...
  CURVE_ARC: 50, // a focused beam can bend: the latched creature is judged (and the latch kept) up to this many degrees further round, times how focused it is...
  CURVE_WEIGHT: 0.85, // ...and counts as in your airflow (drain, pull) at this weight times the focus
  BREAK_ANGLE: 75, // ...within this many degrees of your facing...
  RANGE: 1.15, // ...and this share of your inhale's reach...
  MEMORY_MS: 350, // ...and survives a moment below those (a little sideways step doesn't lose it)
  SMOOTHING: 6, // airflow quality is smoothed at this rate a second (its stability)
  ASSIST: 0.6, // a focused latch adds this much aim toward its target (your own turning does the rest)...
  SIZE_MIN: 0.75, // ...times sqrt(your width / theirs), kept within these
  SIZE_MAX: 1.35,
  HYSTERESIS: 0.25, // inhaling each other: the other side needs a latch this much better to take the focused connection...
  TIE: 0.1, // ...and from nothing, within this of each other, neither gets it
  OVERLAP_SMOTHER: 0.4, // bodies overlapping by this share of the smaller one's width smother the air completely
  OVERLAP_DRAIN_MIN: 0.25,
  SCALE_FULL_RATIO: 0.35, // scale separation: an attacker at least this share of your width drains you fully...
  SCALE_MIN_RATIO: 0.1, // ...one this small (or smaller) only at SCALE_MIN: a mosquito alone, dangerous only in numbers or through the arena
  SCALE_MIN: 0.08, // smothered air still drains this share of gems
  RAMP_MIN_QUALITY: 0.35, // the drain ramp builds only on airflow at least this clean; below, it fades...
  RAMP_FADE: 1.5, // ...this many times as fast as it built
  SWALLOW_MIN_QUALITY: 0.5, // a swallow needs airflow at least this clean (size alone isn't enough)
  BEAM_FOCUS_FROM: 0.25, // the cone starts focusing into a stream at this quality...
  BEAM_FULL_AT: 0.6, // ...and is a tight stream by this (qualities a real fight reaches)
  BEAM_STABLE_MS: 400, // a focused connection has to hold this long before it saves breath
  BEAM_EFFICIENT_FROM: 0.4, // breath use falls from this beam quality...
  BEAM_NEUTRAL_AT: 0.75, // ...to nothing here...
  BEAM_RECHARGE_MS: 9000, // ...and above, it refills (at best empty to full in this long; out of combat it's INHALE.REFILL_MS)...
  DANGER_SHARE: 0.5, // only the inner share of an inhale's reach is lethal: gem drain fades to nothing over the outer part (range catches, closeness kills)
  PRESSURE_BUILD_S: 0.35, // drain on a newly caught creature builds from nothing over this long for a newborn...
  PRESSURE_SIZE_GROWTH: 0.35, // ...longer as (width / newborn) ^ this for bigger inhalers (about 0.7s at 100 gems); the pull lock too
  BEAM_RECHARGE_CAP: 0.8, // ...but never past this share of a full breath while inhaling
} as const;

/**
 * The camera (see game/camera): a soft-follow rig. It follows you on a critically damped spring,
 * leading your movement a little (and your facing, more while inhaling), never far off you; and
 * it zooms by how big you should look on screen, but never so close that a bigger creature could
 * reach the lethal part of its airflow before you'd have seen it coming (the threat horizon).
 */
export const CAMERA = {
  SIZE_SHARE: 0.06, // a newborn would fill this share of the screen's short side...
  SIZE_SHARE_GROWTH: 0.45, // ...growing as (width / a newborn's) ^ this (about 10% at 25 gems, 15% at 100), so growth outpaces the zoom...
  SIZE_SHARE_MAX: 0.35, // ...up to this. Late-game target: about 1500 gems is 27x a newborn's width and fills about 27% of the screen, a newborn beside it about 1%
  THREAT_RATIO: 1.5, // ...but the view always shows a creature this many times wider coming...
  REACTION_S: 0.9, // ...this long before the lethal part of its airflow could reach you (this wins at small sizes)...
  THREAT_MAX_WIDTH: 150, // ...planned for creatures up to this wide; past it there's little bigger to fear, so your growth fills the screen
  LOCKED: true as boolean, // the view stays centered on you, Agar.io-style: no lead, no lag (false brings back the soft follow below)
  LOOK_AHEAD_S: 0.22, // (soft follow) the camera leads your movement by this much of your velocity...
  FACING: 0.02, // ...plus a little toward where you face (a share of the view's short side)...
  INHALE_FACING: 0.06, // ...more while inhaling, where the fight is...
  MAX_OFFSET: 0.12, // ...never more than this share of the view off you
  LOOK_SMOOTH: 3, // look-ahead changes smoothed at this rate a second (no jitter from the stick)
  FOLLOW_OMEGA: 7, // position follows on a critically damped spring this stiff (settles in about half a second)...
  ZOOM_OMEGA: 2.5, // ...zoom on a softer one
} as const;

/**
 * Capture and the living cannonball. A creature pulled to the mouth of one at least INHALE.EAT_RATIO
 * wider is caught for HOLD_MS at most. A captive escapes with three to five directional inputs,
 * depending on the captor's size advantage. A new action press fires it after loading; an early press
 * queues the shot. Releasing inhale leaves the capture intact. Flights can steer sideways and deal
 * one damaging hit. After landing, LAND_SAFE_MS blocks incoming suction and recapture; ordinary
 * release/escape uses RECAPTURE_MS. Whole-swallow constants remain for the older implementation.
 */
export const CANNON = {
  HOLD_MS: 4500, // a brief capture, then automatic release
  CAPTIVE_STUN_MS: 600,
  ESCAPE_KEYS: 3, // rises to four at a 2x width advantage, five at 4x
  ESCAPE_PRESS: 0.6, // a push counts once the stick goes past this...
  ESCAPE_NEUTRAL: 0.3, // ...after coming back within this, so holding a direction is one push, not many
  ESCAPE_PUSH: 110, // out, it pops from the mouth this hard (and can't be caught again for RECAPTURE_MS)
  LAUNCH_MIN_MS: 120, // (the old release rule; firing is gated by ARM_MS now)
  ARM_MS: 1200, // base loading; each extra escape input adds 200ms, up to 1.6 seconds
  HOLD_RATIO: 1, // the captor pulls its captive back to its mouth at this times the captive's own top speed...
  HOLD_MIN: 0.5, // ...times its firmness: this when just big enough to catch it (a near-size captive can simply push out)...
  HOLD_PER_DOUBLING: 0.35, // ...rising this much every time the captor is twice as big again...
  HOLD_MAX: 1.4, // ...up to this; and times how squarely it faces its captive (sideways slips weaken it)...
  HOLD_SIDEWAYS: 0.5, // ...and across its facing it grips only this hard: pushing straight out of a much bigger mouth fails, slipping sideways works
  AIM_TWIST: 1.4, // pushing sideways twists the captor's aim up to this many radians a second (less for a much smaller captive)
  BREAK_GAP: 0.7, // pushed out this share of its own width past the hold point (or past where it was caught, if further)...
  BREAK_MARGIN: 12, // ...plus this many units, the captive breaks free...
  BREAK_PUSH: 70, // ...pushed this far clear
  SWALLOW_RATIO: 2, // swallowing needs the captor this many times wider, whatever the captive holds (an empty one is no exception)...
  SWALLOW_MS: 900, // ...and the captive pinned (within SUBDUED) this long in all during the hold
  SUBDUED: 0.25, // pinned: within this share of its width of the hold point (8 units at least)
  SWALLOW_PENALTY_SHARE: 0.25, // swallowed, a creature is gulped, not knocked out: it pops back out alive, this share of its gems lighter (rounded up)...
  SWALLOW_PENALTY_MAX: 15, // ...never more than this many, scattered where it pops out for anyone (itself only after a moment)
  GULP_MS: 900, // how long it rides inside its swallower before popping back out (the swallower's mouth is full meanwhile: no inhaling)
  EXPEL_GAP: 6, // it pops out behind its swallower, this far clear of its body...
  EXPEL_PUSH: 110, // ...pushed this much farther...
  EXPEL_PROTECT_MS: 2500, // ...and can't be caught again (by a mouth or a turbine) for this long
  RECAPTURE_MS: 1500, // let go or broken free: can't be caught by a mouth or a turbine for this long
  LAND_SAFE_MS: 3000, // after any flight, ignore incoming suction and captures while moving clear
  LAUNCH_INFLUENCE: 0.35, // the captive's sideways push as it's launched shifts its direction up to this many radians
  LAUNCH_SPEED_MIN: 1250, // launch speed (units a second) for a captor just big enough to catch its captive (CAPTURE_RATIO wider)...
  LAUNCH_SPEED_PER_DOUBLING: 300, // ...plus this every time the captor is twice as wide again, relative to its captive...
  LAUNCH_SPEED_MAX: 2000, // ...up to this (reached at LAUNCH_RATIO_CAP times wider)
  LAUNCH_RATIO_CAP: 8,
  LAUNCH_CLEARANCE: 4, // the captive is set this far clear of the captor's body before it flies, so the two never start the flight overlapping
  DRAG: 0.35, // a captive's flight loses this share of its speed a second (with FLIGHT_MS, it carries about 2,100 units at the minimum speed and 3,400 at the maximum, in the open: most of the arena)...
  STOP_SPEED: 140, // ...and ends below this speed...
  FLIGHT_MS: 2600, // ...or after this long (a turbine's throw has its own: TURBINE.PLAYER_DRAG, PLAYER_FLIGHT_MS)
  STEER: 520, // a flier's sideways steering (units a second squared): it bends the path, never speeds it up, stops or reverses it
  LAUNCHER_GRACE_MS: 300, // a projectile can't hit its launcher this soon
  IMPACT_BASE: 10, // a hit knocks this many of the target's gems loose...
  IMPACT_PER_ROOT: 7, // ...plus this times the square root of its gems (diminishing against giants), times the hit's speed against IMPACT_SPEED_REF and the flier's mass: a living cannonball is the big hit of the game (about 60 of 120, 150 of 400)...
  IMPACT_SPEED_REF: 900,
  IMPACT_SHARE: 0.5, // ...and never less than this share of everything it holds (times the hit's speed), whatever its size: a giant that's hit shrinks a lot...
  IMPACT_MAX_SHARE: 0.6, // ...but never more than this share of them (devastating, never deleting)
  IMPACT_IMMUNE_MS: 1200, // a creature just hit can't be hit by another flier for this long
  IMPACT_STUN_MS: 450, // the target is stunned this long...
  TARGET_SHOVE: 120, // ...and knocked up to this far along the hit (less the heavier it is than the flier)
  BOUNCE: 0.35, // the flier bounces back keeping this share of its speed; one damaging hit per launch
} as const;

export const SHIFT = {
  ENABLED: false, // arena shifts (the red zone, the shrinking floor and its jackpot) are switched off for now; true brings them back (tests turn them on per world)
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
 * exhaust's wind pushes players too, small ones most. Gems are moved around, never lost. A creature
 * that reaches the intake is pulled through, loses a share of its gems, and is fired out of the exhaust.
 */
export const TURBINE = {
  ENABLED: true,
  COUNT_MIN: 3, // how many there are at once: between these two...
  COUNT_MAX: 5, // ...rolled again every time one goes, so the number drifts; the only gap is a turbine on its way back (RESPAWN_*)
  BODY_RADIUS: 60, // the turbine itself is solid
  INTAKE_REACH: 520, // how far in front of the intake its suction reaches...
  INTAKE_ARC: 0.7, // ...within this angle (radians) either side of where it points
  DANGER_REACH: 190, // anyone this close to the intake (edge to edge) has gems ripped out of them...
  STRIP_RATE: 3, // ...this many a second...
  STRIP_PER_ROOT: 1.5, // ...plus this times the square root of their weight (giants lose them fastest)
  GEM_PULL: 480, // units a second loose gems are pulled at near the intake (a quarter of that at the edge)
  PULL_RATIO: 1.35, // creatures are pulled at this times their own top speed right at the intake, easing (squared) to nothing at its reach: from about 75 units in, nobody outwalks it (the point of no return)
  THROUGH_GAP: 8, // a creature this close to the intake is pulled through it...
  THROUGH_SHARE: 0.25, // ...losing this share of its gems on the way (giants lose the most)...
  THROUGH_MIN: 1, // ...and at least this many...
  EXHAUST_LAUNCH: 1150, // ...then fired out of the exhaust this fast, flying (see CANNON)...
  PLAYER_DRAG: 1.1, // ...losing this share of its speed a second...
  PLAYER_FLIGHT_MS: 1400, // ...for at most this long (a throw, shorter than a captor's shot)
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
  WIND: 360, // ...pushing a newborn this fast right at the nozzle (see WIND_WEIGHT_POWER), easing to nothing at the end
  WIND_WEIGHT_POWER: 0.3, // ...divided by weight to this power, so giants get shoved too (about a third as hard at 100 gems)
  WARNING_MS: 3000, // a new turbine shows where it's coming for this long before it switches on...
  LIFE_MIN_MS: 60000, // ...runs this long...
  LIFE_MAX_MS: 90000,
  POWER_DOWN_MS: 2000, // ...powers down (finishing the gems already inside)...
  RESPAWN_MIN_MS: 3000, // ...and comes back somewhere else this much later
  RESPAWN_MAX_MS: 7000,
  EDGE_MARGIN: 600, // never this close to the world's edge,
  SPACING: 1150, // another turbine (five still fit comfortably),
  PLAYER_CLEARANCE: 450, // or a player
} as const;

/**
 * Exhaling: the button tapped with nothing in your mouth. A short puff out of the mouth: loose gems in
 * front of it are blown away, and creatures in it are shoved back by weight. The inhale's opposite, and
 * the small creature's answer to being robbed: a shove out of a mouth's reach.
 */
export const EXHALE = {
  REACH: 160, // the puff reaches this far from the mouth, plus REACH_PER_SIZE times your width (about 200 for a newborn, 450 at 100 gems)
  REACH_PER_SIZE: 2,
  ARC: 55, // degrees either side of where you face
  GEM_PUSH: 420, // loose gems right at the mouth are blown away at this (units a second), easing to nothing at the reach
  BODY_PUSH: 400,
  PUSH_RATIO_MIN: 0.5, // even a small defender makes real space against a giant
  PUSH_RATIO_MAX: 1.8,
  PUSH_MAX: 500,
  DEFENSE_PUSH: 200,
  COOLDOWN_MS: 1800, // a deliberate defense, not repeated knockback
  BREAK_MS: 1000, // a successful puff breaks suction on its user for a short escape window
  PARRY_MS: 350, // minimum restart lock on a broken inhale
  STUN_MS: 800, // a gust hit disables steering and inhaling; knockback still carries the target away
} as const;

/** Short, announced resource contests in the continuous world. */
export const SURGE = {
  FIRST_MS: 30000,
  GAP_MIN_MS: 60000,
  GAP_MAX_MS: 90000,
  WARNING_MS: 8000,
  ACTIVE_MS: 18000,
  SHOWER_MS: 3000,
  PIECES: 10,
  VALUE: 2,
  RADIUS: 190,
  JACKPOT_WITH_MS_LEFT: 5000,
} as const;

export const ARENA_RULES = {
  PLAYER_SIZE: 20, // a new player's size; gems make you bigger (GEMS.BASE_MASS)
  HOP: 60, // one tap = one hop, while you're small...
  HOP_BEYOND_SIZE: 12, // ...and once you're big, your size plus this, so a hop always clears you
  MOVE_SPEED: 320, // top speed (units a second) for a newborn...
  SPEED_FALLOFF: 0.3, // growth slows movement gently
  MIN_SPEED: 130,
  // Contact grip: creatures are soft bodies, not billiard balls
  CONTACT_SQUISH: 0.15, // touching creatures squish up to this share of the smaller one's width into each other before pushing back hard...
  SCALE_SHOVE_RATIO: 4, // something this many times wider moving into a creature pushes it aside instead of being stopped by it
  CONTACT_TOUCH: 3, // ...count as touching within this many units...
  CONTACT_GRIP: 0.8, // ...and pressed together, this share of each step's sideways movement is undone so they stay put instead of orbiting (moving away peels off freely)
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
  SURGE,
  CORE,
  LATCH,
  CAMERA,
  CANNON,
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
