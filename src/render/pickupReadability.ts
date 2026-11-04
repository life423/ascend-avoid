export interface PickupEvent { amount: number; at: number }
export interface PickupLabel { amount: number; alpha: number; offsetY: number; fontSize: number }

/** Two quiet counters replace overlapping individual +1s; values still sum the actual live awards. */
export function pickupLabels(events: PickupEvent[], now: number, duration: number, pixel: number, isLeader: boolean, reducedMotion: boolean): PickupLabel[] {
    const groups = [{ amount: 0, at: -Infinity }, { amount: 0, at: -Infinity }]
    for (const event of events) {
        const age = now - event.at
        if (age < 0 || age >= duration || !Number.isFinite(event.amount)) continue
        const group = groups[event.amount > 0 ? 0 : 1]
        group.amount += event.amount; group.at = Math.max(group.at, event.at)
    }
    const fontSize = Math.max(18, 12 * pixel)
    const lift = reducedMotion ? 0 : (now - Math.max(...groups.map(group => group.at))) / duration * 24 * pixel
    return groups.flatMap((group, lane) => {
        if (group.amount === 0) return []
        const t = (now - group.at) / duration
        return [{ amount: group.amount, alpha: 1 - t, fontSize,
            offsetY: (isLeader ? 64 : 22) + 8 * pixel + lane * (fontSize + 4 * pixel) + lift }]
    })
}
