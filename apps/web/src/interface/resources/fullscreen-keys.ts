/** Fullscreen keys stay outside game input and dialog navigation. */
export function reserveFullscreenKeys(): () => void {
  const handle = (event: KeyboardEvent) => {
    const escape = event.key === 'Escape' || event.code === 'Escape';
    const fullscreen = event.key === 'F11' || event.code === 'F11';
    if (!escape && !fullscreen) return;
    event.stopImmediatePropagation();
    if (escape || document.fullscreenElement) event.preventDefault();
    if (event.type === 'keydown' && !event.repeat && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
  };
  window.addEventListener('keydown', handle, true);
  window.addEventListener('keyup', handle, true);
  return () => {
    window.removeEventListener('keydown', handle, true);
    window.removeEventListener('keyup', handle, true);
  };
}
