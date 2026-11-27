/** Recover space reserved by Chrome inside an already-fullscreen Android app. */
export function recoverAndroidFullscreen(): void {
    if (!/Android/i.test(navigator.userAgent) || !matchMedia('(display-mode: fullscreen)').matches ||
        document.fullscreenElement || !document.fullscreenEnabled || !navigator.userActivation?.isActive) return;

    const viewport = window.visualViewport;
    // Only a layout gap qualifies. A keyboard or pinch can shrink just the visual viewport.
    // Android rounds screen and layout measurements independently to CSS pixels.
    if (!viewport || viewport.scale !== 1 || Math.abs(viewport.height - innerHeight) > 2 ||
        Math.abs(outerHeight - screen.height) > 2 || outerHeight - innerHeight <= 2) return;

    // Request on the original gesture. A denied request must still allow normal play.
    void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}
