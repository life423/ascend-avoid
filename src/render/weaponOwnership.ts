/** Ownership is a local view of the authoritative builder id, never inferred from weapon kind/color. */
export const WEAPON_OWNERSHIP = { mint: '#80fff1', edge: '#07131f', hostile: '#ff896f' } as const;
export function ownsWeapon(weapon: { owner: string }, localId: string | null | undefined): boolean {
    return Boolean(localId && weapon.owner && weapon.owner === localId);
}

/** Stroke an existing path with an opaque separating edge, including over white creatures/bright loot. */
export function ownershipStroke(ctx: CanvasRenderingContext2D, color: string, width: number, unit: number): void {
    ctx.save();
    ctx.strokeStyle = WEAPON_OWNERSHIP.edge; ctx.lineWidth = width + 4 * unit; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    ctx.restore();
}

/** Small upright shield, attached to the rim rather than a floating label. */
export function ownershipShield(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-size * .46, -size * .42); ctx.lineTo(size * .46, -size * .42);
    ctx.lineTo(size * .4, size * .14); ctx.quadraticCurveTo(size * .28, size * .4, 0, size * .58);
    ctx.quadraticCurveTo(-size * .28, size * .4, -size * .4, size * .14); ctx.closePath();
    ctx.fillStyle = WEAPON_OWNERSHIP.edge; ctx.fill();
    ownershipStroke(ctx, WEAPON_OWNERSHIP.mint, size * .16, size * .13);
    ctx.restore();
}

const reveals = new WeakMap<object, { owner: string; complete: boolean; at: number | null }>();
/** Reveal once on assembly/ownership acquisition, never again when a carried weapon is placed. */
export function ownershipReveal(weapon: { owner: string; phase: string }, localId: string | null | undefined, now: number): number | null {
    const own = ownsWeapon(weapon, localId), complete = weapon.phase !== 'waiting' && weapon.phase !== 'parts';
    const before = reveals.get(weapon);
    const at = own && complete && (!before?.complete || before.owner !== weapon.owner)
        ? (weapon.phase === 'carried' || before ? now : null) : before?.at ?? null;
    reveals.set(weapon, { owner: weapon.owner, complete, at });
    return own && complete && at !== null && now >= at && now - at < 650 ? (now - at) / 650 : null;
}

/** CSS-sized readable rim; little expansion on assembly, a quiet static mark afterward. */
export function drawOwnership(ctx: CanvasRenderingContext2D, unit: number, reveal: number | null, reducedMotion: boolean): void {
    const radius = Math.max(48, 15 * unit);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (reveal !== null && !reducedMotion) {
        ctx.globalAlpha *= .45 * (1 - reveal);
        ctx.beginPath(); ctx.arc(0, 0, radius + (2 + 7 * reveal) * unit, 0, Math.PI * 2);
        ownershipStroke(ctx, WEAPON_OWNERSHIP.mint, 1.2 * unit, unit);
    }
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(0, 0, radius, Math.PI / 4 + .18, Math.PI / 4 + Math.PI * 2 - .18);
    ownershipStroke(ctx, WEAPON_OWNERSHIP.mint, 1.5 * unit, unit);
    ownershipShield(ctx, radius / Math.SQRT2, radius / Math.SQRT2, 8 * unit);
    ctx.restore();
}
