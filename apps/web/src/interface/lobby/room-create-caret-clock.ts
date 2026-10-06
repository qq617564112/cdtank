/** WLEditbox::updateSelf uses a float elapsed counter and strict half-period comparisons. */
export function advanceRoomCreateCaret(elapsed: number, deltaSeconds: number) {
  const next = Math.fround(elapsed) + Math.fround(deltaSeconds);
  return next > 1 ? {elapsed: 0, visible: true} : {elapsed: Math.fround(next), visible: next <= 0.5};
}
