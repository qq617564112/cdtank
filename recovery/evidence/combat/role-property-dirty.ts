export interface RolePropertyChangeProbe {
  category: number;
  changed: () => number;
}

/** Original545eb0/5448e0 compare bound bytes against their stored snapshot. */
export function rolePropertyBytesChanged(
  current: Uint8Array | undefined,
  snapshot: Uint8Array | undefined,
): boolean {
  if (!current || !snapshot) return false;
  for (let i = 0; i < current.length; i++) {
    if (current[i] !== snapshot[i]) return true;
  }
  return false;
}

/** Original529a60: mode1 permits scanning; schema mode2 requires a pending bit. */
export function detectRolePropertyChanges(
  words: Uint32Array,
  mode: number,
  schemaMode: number,
  properties: readonly RolePropertyChangeProbe[],
): boolean {
  if (mode !== 1) return false;
  if (schemaMode === 2 && !words.some(word => word !== 0)) return false;
  words.fill(0, 0, 8);
  for (let index = 0; index < properties.length; index++) {
    const property = properties[index];
    if (property.category >= 1 && property.category <= 7
      && (property.changed() & 0xff) === 1) {
      words[index >>> 5] |= 1 << (index & 31);
    }
  }
  return words.some(word => word !== 0);
}
