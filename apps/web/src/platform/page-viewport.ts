import {isMobileDevice} from './device';
import './page-viewport.css';

export const MOBILE_PAGE = {width: 960, height: 540} as const;
export const MOBILE_ACCOUNT_PAGE = {width: 720, height: 405} as const;

const viewportListeners = new Set<() => void>();

function gameViewportBounds() {
  const viewport = isMobileDevice() ? window.visualViewport : undefined;
  return {width: viewport?.width ?? innerWidth, height: viewport?.height ?? innerHeight,
    left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0};
}

/** Pages use the safe landscape area, from 16:9 through 21:9. */
export function gamePageBounds() {
  const viewport = gameViewportBounds();
  const style = getComputedStyle(document.documentElement);
  const inset = (edge: string) => parseFloat(style.getPropertyValue(`--game-safe-${edge}`)) || 0;
  const left = inset('left'), right = inset('right'), top = inset('top'), bottom = inset('bottom');
  const availableWidth = Math.max(1, viewport.width - left - right);
  const availableHeight = Math.max(1, viewport.height - top - bottom);
  const width = Math.min(availableWidth, availableHeight * 21 / 9);
  const height = Math.min(availableHeight, width * 9 / 16);
  return {width, height, left: viewport.left + left + (availableWidth - width) / 2,
    top: viewport.top + top + (availableHeight - height) / 2};
}

export function mobilePageSize(height = MOBILE_PAGE.height) {
  const bounds = gamePageBounds();
  return {width: height * bounds.width / bounds.height, height};
}

export function fullPageScale(): number {
  const size = isMobileDevice() ? mobilePageSize() : {width: 800, height: 600};
  return gamePageScale(size.width, size.height);
}

export function gamePageScale(width: number, height: number): number {
  const bounds = gamePageBounds();
  return Math.min(bounds.width / width, bounds.height / height);
}

/** Account sheets use larger native controls on phones and tablets. */
export function accountPageScale(): number {
  return isMobileDevice() ? gamePageBounds().height / MOBILE_ACCOUNT_PAGE.height
    : gamePageScale(800, 600);
}

export function sourceDialogScale(width: number, height: number): number {
  return isMobileDevice() ? Math.min(accountPageScale(), gamePageScale(width + 16, height + 16))
    : gamePageScale(800, 600);
}

/** Layout consumers resize after the shared safe-area CSS variables are updated. */
export function subscribeGamePageViewport(listener: () => void): () => void {
  viewportListeners.add(listener);
  listener();
  return () => {viewportListeners.delete(listener);};
}

export function installGamePageViewport(): () => void {
  let frame: number | undefined;
  const update = () => {
    frame = undefined;
    const viewport = gameViewportBounds();
    for (const [name, value] of Object.entries(viewport)) {
      document.documentElement.style.setProperty(`--game-viewport-${name}`, `${value}px`);
    }
    const bounds = gamePageBounds();
    for (const [name, value] of Object.entries(bounds)) {
      document.documentElement.style.setProperty(`--game-page-${name}`, `${value}px`);
    }
    document.documentElement.style.setProperty('--mobile-page-width', `${540 * bounds.width / bounds.height}px`);
    document.documentElement.style.setProperty('--mobile-account-width', `${405 * bounds.width / bounds.height}px`);
    for (const listener of viewportListeners) listener();
  };
  const schedule = () => {frame ??= requestAnimationFrame(update);};
  const viewport = isMobileDevice() ? window.visualViewport : undefined;
  update();
  window.addEventListener('resize', schedule);
  screen.orientation?.addEventListener('change', schedule);
  document.addEventListener('fullscreenchange', schedule);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  return () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    screen.orientation?.removeEventListener('change', schedule);
    document.removeEventListener('fullscreenchange', schedule);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
  };
}
