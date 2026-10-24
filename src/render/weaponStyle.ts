import { WEAPON_RECIPES } from '../../server/constants/gameConstants';

export const PART_COLORS = ['#ffd47d', '#80e7de', '#ffa8be'];
export const weaponRecipe = (kind: string | undefined) => kind === 'pulsar' ? WEAPON_RECIPES.pulsar : WEAPON_RECIPES.pinwheel;
