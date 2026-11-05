import { ARENA_RULES, GEMS, WORLD } from '../constants/gameConstants.js';

/** Banked gems convert to physical growth progressively, with a gentler opening and uncapped score. */
function growthMass(gems: number): number {
  const opening = GEMS.GROWTH_OPENING_GEMS;
  const mass = gems <= opening ? Math.max(0, gems) : opening + GEMS.GROWTH_SCALE / GEMS.GROWTH_EXPONENT * Math.expm1(GEMS.GROWTH_EXPONENT * Math.log1p((gems - opening) / GEMS.GROWTH_SCALE));
  return mass * GEMS.GROWTH_MASS_PER_GEM;
}

/** Inverse for spending physical growth, so a tapered giant still shrinks when used as ammunition. */
export function gemsForGrowthMass(mass: number): number {
  mass /= GEMS.GROWTH_MASS_PER_GEM;
  const opening = GEMS.GROWTH_OPENING_GEMS;
  return mass <= opening ? Math.max(0, mass) : opening + GEMS.GROWTH_SCALE * Math.expm1(Math.log1p((mass - opening) * GEMS.GROWTH_EXPONENT / GEMS.GROWTH_SCALE) / GEMS.GROWTH_EXPONENT);
}

function sizeLimits(worldWidth: number, worldHeight: number): { start: number; maximum: number } {
  const side = Math.min(worldWidth, worldHeight);
  const maximum = Math.max(ARENA_RULES.PLAYER_SIZE, side * GEMS.SIZE_MAX_SHARE);
  const start = Math.max(ARENA_RULES.PLAYER_SIZE, side * GEMS.SIZE_SOFT_START_SHARE);
  return { start, maximum };
}

/** Unrounded earned-growth curve. Live bodies retain fractional mass across small transactions. */
function earnedWidth(gems: number, worldWidth: number, worldHeight: number): number {
  const { start, maximum } = sizeLimits(worldWidth, worldHeight);
  const raw = ARENA_RULES.PLAYER_SIZE * Math.sqrt(1 + growthMass(Math.max(0, gems)) / GEMS.BASE_MASS);
  const span = maximum - start;
  return raw <= start ? raw : span > 0 ? start - span * Math.expm1(-(raw - start) / span) : maximum;
}

/** Absolute setup/reference size. Live growth is held independently of the gem bank. */
export function creatureSize(gems: number, worldWidth: number = WORLD.WIDTH, worldHeight: number = WORLD.HEIGHT): number {
  const { maximum } = sizeLimits(worldWidth, worldHeight);
  const size = earnedWidth(gems, worldWidth, worldHeight);
  return Math.min(maximum, Math.round(size * 2) / 2);
}

/** Mass used for visible-body impact comparisons, independent of banked score at very late sizes. */
export function bodyMass(width: number): number {
  return GEMS.BASE_MASS * (Math.max(0, width) / ARENA_RULES.PLAYER_SIZE) ** 2;
}

/** Current ordinary growth above the newborn body; no mass is banked beyond the visible cap. */
export function maximumBodyGrowth(worldWidth: number, worldHeight: number): number {
  return Math.max(0, bodyMass(sizeLimits(worldWidth, worldHeight).maximum) - GEMS.BASE_MASS);
}

export function bodyGrowthForGems(gems: number, worldWidth: number, worldHeight: number): number {
  const { maximum } = sizeLimits(worldWidth, worldHeight);
  const width = earnedWidth(gems, worldWidth, worldHeight);
  // Reaching the rendered maximum is the finite saturated endpoint. Further
  // receipts add wealth only, rather than an invisible reserve near the asymptote.
  const bounded = Math.round(width * 2) / 2 >= maximum ? maximum : width;
  return Math.max(0, bodyMass(bounded) - GEMS.BASE_MASS);
}

export function bodyWidthForGrowth(growth: number, worldWidth: number, worldHeight: number): number {
  const mass = Math.min(maximumBodyGrowth(worldWidth, worldHeight), Math.max(0, growth));
  const width = ARENA_RULES.PLAYER_SIZE * Math.sqrt(1 + mass / GEMS.BASE_MASS);
  return Math.min(sizeLimits(worldWidth, worldHeight).maximum, Math.round(width * 2) / 2);
}

/** Full inverse, including the late width taper. The saturated endpoint has no backing reserve. */
function gemsForBodyGrowth(growth: number, worldWidth: number, worldHeight: number): number {
  const { start, maximum } = sizeLimits(worldWidth, worldHeight);
  const width = ARENA_RULES.PLAYER_SIZE * Math.sqrt(1 + Math.max(0, growth) / GEMS.BASE_MASS);
  if (width >= maximum) return Infinity;
  const span = maximum - start;
  const raw = width <= start ? width : start - span * Math.log1p(-(width - start) / span);
  return gemsForGrowthMass(Math.max(0, bodyMass(raw) - GEMS.BASE_MASS));
}

/** Only newly accepted gems grow a live body. Old wealth is deliberately absent. */
export function addBodyGrowth(growth: number, earned: number, worldWidth: number, worldHeight: number): number {
  const maximum = maximumBodyGrowth(worldWidth, worldHeight);
  const current = Math.min(maximum, Math.max(0, growth));
  if (earned <= 0 || current >= maximum) return current;
  const width = earnedWidth(gemsForBodyGrowth(current, worldWidth, worldHeight) + earned, worldWidth, worldHeight);
  // Keep live receipts at full precision. Applying setup's rendered-cap snap
  // here would let a one-gem pickup erase an accumulated subpixel debit.
  return Math.min(maximum, Math.max(0, bodyMass(width) - GEMS.BASE_MASS));
}
