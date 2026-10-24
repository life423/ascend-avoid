import { WEAPON_RECIPES } from '../../server/constants/gameConstants';

export const PART_COLORS = ['#ffd47d', '#80e7de', '#ffa8be'];
export const weaponRecipe = (kind: string | undefined) => kind === 'pulsar' ? WEAPON_RECIPES.pulsar : WEAPON_RECIPES.pinwheel;

/** Compact placement keeps the weapon status above the sticks, or between them in landscape. */
export function weaponChipBounds(width: number, height: number, scale: number) {
    const landscape = height / scale < 500;
    const chipWidth = Math.min(width - 32 * scale, 238 * scale);
    return { x: (width - chipWidth) / 2, y: height - (landscape ? 72 : 218) * scale, width: chipWidth, height: 36 * scale };
}
