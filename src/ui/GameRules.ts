/** Brief controls shared by Help surfaces. */
import { EXHALE } from '../../server/constants/gameConstants';
export const GAME_RULES = `
<p>Gather gems, grow and fire captured rivals. Bullets share one size.</p>
<h4>Move & aim</h4><p>Keyboard uses WASD/arrows. Mouse follows the cursor. On touch, left stick moves and right control aims.</p>
<h4>Capture & fire</h4><p>Hold Space or INHALE. Healthy smaller rivals become ammunition. Release, aim, tap FIRE. Captives escape if held too long. Empty tap: a puff wraps behind and shoves once, costing ${Math.round(EXHALE.BREATH_COST * 100)}% of a full breath. No stun or shield.</p>
<h4>Injury & rewards</h4><p>Cracked? Move to escape: breathing is blocked. Reaching a captor’s mouth shatters injured prey. Lethal shots and violet black holes pay the shooter directly; ordinary players pass safely around holes. Hollow gold rings warn where a hole will open next. A dark core stays dangerous until it disappears.</p>
<h4>Build</h4><p>Collect matching parts; follow radar. Inhale carried parts to steal. E or Place weapon deploys. Satellites pause to charge. Hollow bolts fizzle; bright rival tracers hurt. Central hits beat outer grazes. A strong central hit or concentrated burst causes injury; weaker hits still cost gems. Mint shields mark your weapons and harmless fire.</p>`;
