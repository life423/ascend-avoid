// iPadOS can identify as a Mac when requesting desktop websites. Keep all
// iPhone/iPad browsers silent, including saved audio choices from older releases.
const appleMobile = /iPad|iPhone|iPod/.test(`${navigator.userAgent} ${navigator.platform}`)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const GAME_AUDIO_AVAILABLE = !appleMobile;
