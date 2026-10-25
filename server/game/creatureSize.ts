import { ARENA_RULES, GEMS, WORLD } from '../constants/gameConstants.js';

/** Banked gems convert to physical growth progressively; the first pickups keep their original reward. */
export function growthMass(gems: number): number {
  const opening = GEMS.GROWTH_OPENING_GEMS;
  return gems <= opening ? Math.max(0, gems) : opening + GEMS.GROWTH_SCALE / GEMS.GROWTH_EXPONENT * Math.expm1(GEMS.GROWTH_EXPONENT * Math.log1p((gems - opening) / GEMS.GROWTH_SCALE));
}

/** Inverse for spending physical growth, so a tapered giant still shrinks when used as ammunition. */
export function gemsForGrowthMass(mass: number): number {
  const opening = GEMS.GROWTH_OPENING_GEMS;
  return mass <= opening ? Math.max(0, mass) : opening + GEMS.GROWTH_SCALE * Math.expm1(Math.log1p((mass - opening) * GEMS.GROWTH_EXPONENT / GEMS.GROWTH_SCALE) / GEMS.GROWTH_EXPONENT);
}

/** Shared physical size: preserve the early climb, then taper late growth to fit the finite arena. */
export function creatureSize(gems: number, worldWidth: number = WORLD.WIDTH, worldHeight: number = WORLD.HEIGHT): number {
  const side = Math.min(worldWidth, worldHeight);
  const maximum = Math.max(ARENA_RULES.PLAYER_SIZE, side * GEMS.SIZE_MAX_SHARE);
  const start = Math.max(ARENA_RULES.PLAYER_SIZE, side * GEMS.SIZE_SOFT_START_SHARE);
  const raw = ARENA_RULES.PLAYER_SIZE * Math.sqrt(1 + growthMass(Math.max(0, gems)) / GEMS.BASE_MASS);
  const span = maximum - start;
  const size = raw <= start ? raw : span > 0 ? start - span * Math.expm1(-(raw - start) / span) : maximum;
  return Math.min(maximum, Math.round(size * 2) / 2);
}

/** Mass used for visible-body impact comparisons, independent of banked score at very late sizes. */
export function bodyMass(width: number): number {
  return GEMS.BASE_MASS * (Math.max(0, width) / ARENA_RULES.PLAYER_SIZE) ** 2;
}
