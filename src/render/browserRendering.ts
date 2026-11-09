const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent

// Keep the Canvas 2D work bounded on the Android Firefox rendering path.
export const ANDROID_FIREFOX_RENDERING = /Android/.test(userAgent) && /Firefox\//.test(userAgent)
