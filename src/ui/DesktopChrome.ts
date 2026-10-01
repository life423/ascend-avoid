import { NAME_EVENT, playerName, setPlayerName } from '../core/PlayerName'

const STORAGE_KEY = 'ascend.barHidden'
const DESKTOP = '(min-width: 1200px)'

const MENU = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'
const CHEVRON_UP = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const CHEVRON_DOWN = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/**
 * Desktop page chrome that stays out of the arena's way. The header is one slim bar that can
 * slide up out of sight (its button or F; a small tab in the top-right corner brings it back).
 * Your name is typed right into it, and How to Play slides in from the right, next to the menu button that
 * opens it (or H; Esc or its x closes it). Whether the bar is hidden is remembered. Phones are
 * untouched.
 */
export class DesktopChrome {
    constructor(private toggleHelp: () => void) {
        const header = document.querySelector('.app-header')
        if (!header) return

        const actions = document.createElement('div')
        actions.className = 'bar-actions'
        actions.innerHTML = `
            <button type="button" class="bar-button" data-action="help" aria-label="Menu" title="Menu: how to play (H)">${MENU}</button>
            <button type="button" class="bar-button" data-action="hide" aria-label="Hide the bar" title="Hide the bar (F)">${CHEVRON_UP}</button>
        `
        const nameField = document.createElement('label')
        nameField.className = 'bar-name'
        nameField.innerHTML = `<span>Name</span><input class="bar-name-input" type="text" maxlength="20" spellcheck="false" autocomplete="off" aria-label="Your name" title="Everyone sees it above your creature and on the leaderboard">`
        header.appendChild(nameField)
        const nameInput = nameField.querySelector<HTMLInputElement>('.bar-name-input')
        if (nameInput) this.setUpName(nameInput)
        header.appendChild(actions)

        const tab = document.createElement('div')
        tab.className = 'bar-tab'
        tab.innerHTML = `
            <button type="button" class="bar-button" data-action="help" aria-label="Menu" title="Menu: how to play (H)">${MENU}</button>
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
            if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement | null)?.tagName === 'INPUT' || !window.matchMedia(DESKTOP).matches) return
            if (e.code === 'KeyF') this.setBarHidden(!document.body.classList.contains('bar-hidden'))
            else if (e.code === 'KeyH') this.toggleHelp()
        })

        this.setBarHidden(this.savedHidden())
    }

    /** Your name, right in the bar: Enter or clicking away saves it (it glows for a moment), Esc puts it back */
    private setUpName(input: HTMLInputElement): void {
        input.value = playerName()
        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                input.blur()
            } else if (e.key === 'Escape') {
                input.value = playerName()
                input.blur()
            }
        })
        input.addEventListener('blur', () => {
            if (input.value.trim() === playerName()) {
                input.value = playerName()
                return
            }
            const name = setPlayerName(input.value)
            input.value = name ?? playerName()
            if (!name) return
            input.classList.add('saved')
            window.setTimeout(() => input.classList.remove('saved'), 900)
        })
        // Renamed some other way: keep the bar in step
        window.addEventListener(NAME_EVENT, (e: Event) => {
            if (document.activeElement !== input) input.value = (e as CustomEvent<string>).detail
        })
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
