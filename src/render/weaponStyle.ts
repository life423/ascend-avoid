import { WEAPON_RECIPES } from '../../server/constants/gameConstants';

export const PART_COLORS = ['#ffd47d', '#80e7de', '#ffa8be'];
export const weaponRecipe = (kind: string | undefined) => WEAPON_RECIPES[kind as keyof typeof WEAPON_RECIPES] ?? WEAPON_RECIPES.pinwheel;
