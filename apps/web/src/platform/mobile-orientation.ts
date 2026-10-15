import {isMobileDevice} from './device';
import {lockMobilePageGestures} from './mobile-page-gestures';
import './mobile-orientation.css';

interface LockableOrientation extends ScreenOrientation {
  lock?: (orientation: 'landscape') => Promise<void>;
}

/** A portrait modal covers every page when the browser cannot lock the screen. */
export function enforceMobileLandscape(): () => void {
  if (!isMobileDevice()) return () => {};
  document.documentElement.dataset.mobileDevice = 'true';
  const restorePageGestures = lockMobilePageGestures();
  const dialog = document.createElement('dialog');
  dialog.className = 'mobile-orientation';
  dialog.setAttribute('aria-label', '请横屏游戏');
  const phone = document.createElement('span');
  phone.className = 'mobile-orientation-phone';
  phone.setAttribute('aria-hidden', 'true');
  const message = document.createElement('p');
  message.textContent = '请将设备横过来';
  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = '横屏游戏';
  dialog.append(phone, message, action);
  document.body.append(dialog);
  const lock = async () => {
    const orientation = screen.orientation as LockableOrientation | undefined;
    try {await orientation?.lock?.('landscape');} catch {}
  };
  action.addEventListener('click', () => {
    const enter = document.documentElement.requestFullscreen;
    if (enter && !document.fullscreenElement) {
      void enter.call(document.documentElement).then(lock).catch(() => {});
    } else void lock();
  });
  dialog.addEventListener('cancel', event => event.preventDefault());
  const update = () => {
    const portrait = matchMedia('(orientation: portrait)').matches;
    if (portrait && !dialog.open) {
      window.dispatchEvent(new Event('blur'));
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      dialog.showModal();
    } else if (!portrait && dialog.open) dialog.close();
  };
  const fullscreen = () => {void lock(); update();};
  const retry = () => {void lock();};
  const dialogs = new MutationObserver(records => {
    if (!dialog.open || !matchMedia('(orientation: portrait)').matches) return;
    if (records.some(record => record.target instanceof HTMLDialogElement
      && record.target !== dialog && record.target.open)) {
      dialog.close();
      dialog.showModal();
    }
  });
  dialogs.observe(document.body, {subtree: true, attributes: true, attributeFilter: ['open']});
  window.addEventListener('resize', update);
  screen.orientation?.addEventListener('change', update);
  document.addEventListener('fullscreenchange', fullscreen);
  document.addEventListener('pointerup', retry, {passive: true});
  update();
  void lock();
  return () => {
    dialogs.disconnect();
    window.removeEventListener('resize', update);
    screen.orientation?.removeEventListener('change', update);
    document.removeEventListener('fullscreenchange', fullscreen);
    document.removeEventListener('pointerup', retry);
    dialog.remove();
    restorePageGestures();
    delete document.documentElement.dataset.mobileDevice;
  };
}
