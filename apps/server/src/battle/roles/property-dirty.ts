/** Original metadata manager +0x40..+0x5c: 256 property dirty bits. */
export function markRolePropertyDirty(words: Uint32Array, index: number): void {
  const member = index & 0xff;
  if (member === 0xfe) {
    words.fill(0xffffffff, 0, 8);
  } else if (member !== 0xff) {
    words[member >>> 5] |= 1 << (member & 31);
  }
}

