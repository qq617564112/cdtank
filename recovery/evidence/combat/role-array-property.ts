export interface RoleArrayProperty {
  width: 1 | 2 | 4;
  count: number;
  /** Bound record bytes and the last transmitted snapshot, in little-endian order. */
  bytes: Uint8Array;
  snapshot: Uint8Array;
}

/** Original544c70: full mode1; otherwise compare slots and choose delta or full. */
export function encodeRoleArrayProperty(
  index: number, field: RoleArrayProperty, mode: number,
): Uint8Array {
  const changed: number[] = [];
  for (let slot = 0; slot < field.count; slot++) {
    const offset = slot * field.width;
    for (let byte = 0; byte < field.width; byte++) {
      if (field.bytes[offset + byte] !== field.snapshot[offset + byte]) {
        changed.push(slot);
        break;
      }
    }
  }
  const operation = (mode & 255) === 1 ? 1
    : changed.length * (field.width + 2) > field.count * field.width ? 3 : 2;
  const slots = operation === 2 ? changed : Array.from({length: field.count}, (_, slot) => slot);
  const length = 7 + slots.length * (field.width + (operation === 2 ? 2 : 0));
  const bytes = new Uint8Array(4 + length);
  const view = new DataView(bytes.buffer);
  bytes[0] = 4;
  bytes[1] = index & 255;
  view.setUint16(2, length);
  bytes[4] = operation;
  view.setUint16(5, field.count);
  view.setUint16(7, field.width);
  view.setUint16(9, slots.length);
  let cursor = 11;
  for (const slot of slots) {
    if (operation === 2) {
      view.setUint16(cursor, slot);
      cursor += 2;
    }
    for (let byte = field.width - 1; byte >= 0; byte--) {
      bytes[cursor++] = field.bytes[slot * field.width + byte]!;
    }
  }
  return bytes;
}

/** Original544950: incoming width/count drive writes; snapshot and dirty stay intact. */
export function receiveRoleArrayProperties(
  fields: ReadonlyMap<number, RoleArrayProperty>,
  segments: readonly Uint8Array[],
  context: number,
  received?: (index: number, context: number) => void,
): boolean {
  for (const segment of segments) {
    const index = segment[1]!;
    const field = fields.get(index);
    if (segment[0] !== 4 || !field) return false;
    const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
    const operation = segment[4];
    const count = view.getUint16(5);
    const width = view.getUint16(7);
    const entries = view.getUint16(9);
    if (operation !== 1 && operation !== 2 && operation !== 3) return false;
    let cursor = 11;
    for (let entry = 0; entry < (operation === 2 ? entries : count); entry++) {
      const slot = operation === 2 ? view.getUint16(cursor) : entry;
      if (operation === 2) cursor += 2;
      for (let byte = 0; byte < width; byte++) {
        field.bytes[slot * width + byte] = view.getUint8(cursor + width - byte - 1);
      }
      cursor += width;
    }
    received?.(index, context >>> 0);
  }
  return true;
}
