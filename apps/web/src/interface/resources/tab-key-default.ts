/** Reserve Tab for game controls throughout the page, including form fields. */
export function disableTabDefault(): () => void {
  const prevent = (event: KeyboardEvent) => {
    if (event.key === 'Tab' || event.code === 'Tab') event.preventDefault();
  };
  window.addEventListener('keydown', prevent, true);
  window.addEventListener('keyup', prevent, true);
  return () => {
    window.removeEventListener('keydown', prevent, true);
    window.removeEventListener('keyup', prevent, true);
  };
}
