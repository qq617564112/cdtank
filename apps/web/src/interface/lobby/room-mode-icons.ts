/** Original5070b9 directory formatter uses raw0..4; image labels establish Web1..5 correspondence. */
export function roomModeIconReference(mode: number): string | undefined {
  if (!Number.isInteger(mode) || mode < 1 || mode > 5) return undefined;
  return `set:gy0 image:${['data', 'ui', 'gy', `${mode - 1}.tga`].join('\\')}`;
}
