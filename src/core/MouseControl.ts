const KEY = 'ascend.mouseFollow';
export const MOUSE_CONTROL_EVENT = 'ascend:mouse-control';
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* default on when storage is unavailable */ }

export function mouseControlEnabled(): boolean { return enabled; }
export function setMouseControl(value: boolean): void {
    enabled = value;
    try { localStorage.setItem(KEY, value ? 'on' : 'off'); } catch { /* optional persistence */ }
    window.dispatchEvent(new Event(MOUSE_CONTROL_EVENT));
}
