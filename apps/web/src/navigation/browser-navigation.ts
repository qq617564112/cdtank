interface BrowserNavigationEntry {
  url: string;
  state: unknown;
}

/** Keep browser history traversal separate from the game's own return controls. */
export function disableBrowserNavigation(readCurrent: () => BrowserNavigationEntry): () => void {
  const retain = () => {
    const current = readCurrent();
    history.pushState(current.state, '', current.url);
  };
  const traversal = (event: PopStateEvent) => {
    event.stopImmediatePropagation();
    retain();
  };
  const keyboard = (event: KeyboardEvent) => {
    const arrow = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const bracket = event.code === 'BracketLeft' || event.code === 'BracketRight';
    const editable = event.target instanceof Element
      && event.target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])');
    const navigation = event.key === 'BrowserBack' || event.key === 'BrowserForward'
      || (event.altKey && !event.ctrlKey && !event.metaKey && arrow && !editable)
      || (event.metaKey && !event.shiftKey && bracket);
    if (navigation || (event.key === 'Backspace' && !editable)) event.preventDefault();
    if (navigation) event.stopImmediatePropagation();
  };
  const mouse = (event: MouseEvent) => {
    if (event.button !== 3 && event.button !== 4) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  retain();
  window.addEventListener('popstate', traversal, true);
  window.addEventListener('keydown', keyboard, true);
  window.addEventListener('keyup', keyboard, true);
  window.addEventListener('mousedown', mouse, true);
  window.addEventListener('mouseup', mouse, true);
  window.addEventListener('auxclick', mouse, true);
  return () => {
    window.removeEventListener('popstate', traversal, true);
    window.removeEventListener('keydown', keyboard, true);
    window.removeEventListener('keyup', keyboard, true);
    window.removeEventListener('mousedown', mouse, true);
    window.removeEventListener('mouseup', mouse, true);
    window.removeEventListener('auxclick', mouse, true);
  };
}
