export type Platform = "ios" | "android" | "desktop"

export function detectPlatform(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent, maxTouch = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1)) return "ios"
  if (/Android/i.test(ua)) return "android"
  return "desktop"
}

export function detectBrowser(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): "safari" | "chrome" | "edge" | "firefox" | "other" {
  if (/Edg\//.test(ua)) return "edge"
  if (/Firefox|FxiOS/.test(ua)) return "firefox"
  if (/CriOS|Chrome\//.test(ua)) return "chrome"
  if (/Safari\//.test(ua)) return "safari"
  return "other"
}
