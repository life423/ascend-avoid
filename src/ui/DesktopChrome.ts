const STORAGE_KEY = 'ascend.barHidden'
const DESKTOP = '(min-width: 1200px)'

const CHEVRON_UP = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const CHEVRON_DOWN = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/**
 * Desktop page chrome that stays out of the arena's way. The header is one slim bar that can
 * slide up out of sight (its button or F; a small tab in the top-right corner brings it back),
 * and How to Play opens in the slide-in drawer (? or H, Esc to close) instead of taking a column
 * beside the game. Whether the bar is hidden is remembered. Phones are untouched.
 */
export class DesktopChrome {
    constructor(private toggleHelp: () => void) {
        const header = document.querySelector('.app-header')
        if (!header) return

        const actions = document.createElement('div')
        actions.className = 'bar-actions'
        actions.innerHTML = `
            <button type="button" class="bar-button" data-action="help" aria-label="How to play" title="How to play (H)">?</button>
            <button type="button" class="bar-button" data-action="hide" aria-label="Hide the bar" title="Hide the bar (F)">${CHEVRON_UP}</button>
        `
        header.appendChild(actions)

        const tab = document.createElement('div')
        tab.className = 'bar-tab'
        tab.innerHTML = `
            <button type="button" class="bar-button" data-action="help" aria-label="How to play" title="How to play (H)">?</button>
            <button type="button" class="bar-button" data-action="show" aria-label="Show the bar" title="Show the bar (F)">${CHEVRON_DOWN}</button>
        `
        document.body.appendChild(tab)

        for (const button of document.querySelectorAll<HTMLButtonElement>('.bar-actions .bar-button, .bar-tab .bar-button')) {
            button.addEventListener('click', () => {
                const action = button.dataset.action
                if (action === 'help') this.toggleHelp()
                else this.setBarHidden(action === 'hide')
                button.blur() // so space goes back to the game, not the button
            })
        }

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || !window.matchMedia(DESKTOP).matches) return
            if (e.code === 'KeyF') this.setBarHidden(!document.body.classList.contains('bar-hidden'))
            else if (e.code === 'KeyH') this.toggleHelp()
        })

        this.setBarHidden(this.savedHidden())
    }

    private setBarHidden(hidden: boolean): void {
        document.body.classList.toggle('bar-hidden', hidden)
        try {
            localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0')
        } catch {
            // Storage can be unavailable (private windows); the choice just isn't remembered
        }
    }

    private savedHidden(): boolean {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1'
        } catch {
            return false
        }
    }
}
