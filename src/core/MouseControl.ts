const KEY = 'ascend.mouseFollow';
export const MOUSE_CONTROL_EVENT = 'ascend:mouse-control';
let enabled = false;
try { enabled = localStorage.getItem(KEY) === 'on'; } catch { /* default to keyboard when storage is unavailable */ }

export function mouseControlEnabled(): boolean { return enabled; }
export function setMouseControl(value: boolean): void {
    enabled = value;
    try { localStorage.setItem(KEY, value ? 'on' : 'off'); } catch { /* optional persistence */ }
    document.querySelectorAll<HTMLButtonElement>('[data-action="mouse"]').forEach(button => {
        button.setAttribute('aria-checked', String(value));
        const state = button.querySelector('span');
        if (state) state.textContent = value ? 'Mouse' : 'Keyboard';
    });
    window.dispatchEvent(new Event(MOUSE_CONTROL_EVENT));
}
