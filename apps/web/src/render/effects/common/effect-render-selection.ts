/** Original type-1 GBF index selection, 0x481a0b–0x481a72. */
export function selectSpriteRenderScript(flags: number, screenSpace: boolean): number {
  if (screenSpace) {
    return flags & 4 ? 5 : 4;
  }
  if (flags & 2) {
    return flags & 4 ? (flags & 8 ? 7 : 3) : (flags & 8 ? 9 : 2);
  }
  return flags & 4 ? (flags & 8 ? 6 : 1) : (flags & 8 ? 8 : 0);
}
