/** The name you play under: kept on this device, so it's there next time (a random one until you pick your own) */
const KEY = 'playerName'

/** Announced on window when you pick a new name, so the game can tell the server */
export const NAME_EVENT = 'ascend:name'

export function playerName(): string {
    try {
        const saved = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY)
        if (saved && saved.trim()) return saved
    } catch {
        // Storage is blocked: a fresh name each visit
    }
    const name = `Player${Math.floor(Math.random() * 10000)}`
    remember(name)
    return name
}

/** Save a name you picked (cleaned up the way the server does); returns it, or null if nothing was left */
export function setPlayerName(raw: string): string | null {
    const name = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20)
    if (!name) return null
    remember(name)
    window.dispatchEvent(new CustomEvent(NAME_EVENT, { detail: name }))
    return name
}

function remember(name: string): void {
    try {
        localStorage.setItem(KEY, name)
    } catch {
        // Storage is blocked: it lasts until you leave
    }
}
