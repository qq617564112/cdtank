import type {DesktopClient} from '../../../shared/contracts/connection';

declare global {
  interface Window {cdtankDesktop?: DesktopClient;}
}

export function desktopClient(): DesktopClient | undefined {
  return window.cdtankDesktop;
}
