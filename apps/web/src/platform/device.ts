/** Phones and tablets include iPadOS browsers that advertise a desktop user agent. */
export function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent)
    || (/Mac/i.test(navigator.platform) && navigator.maxTouchPoints > 1)
    || (matchMedia('(pointer: coarse)').matches
      && !/Windows NT|Macintosh|X11/i.test(navigator.userAgent));
}
