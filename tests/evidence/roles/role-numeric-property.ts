/** Original OdlPlayer numeric properties verified through545f10/545ff0. */
export type RoleNumericPropertyIndex = 5 | 8 | 12 | 13;

const FIELDS: Record<RoleNumericPropertyIndex, number> = {5: 0x38, 8: 0x44, 12: 0x54, 13: 0x58};

/** Category1 segment; current bullet type14 is unsigned32; maximum/HP type5 is signed32. */
export function encodeRoleNumericProperty(index: RoleNumericPropertyIndex, value: number): Uint8Array {
  const segment = new Uint8Array(8);
  segment[0] = 1;
  segment[1] = index;
  const view = new DataView(segment.buffer);
  view.setUint16(2, 4);
  view.setUint32(4, value >>> 0);
  return segment;
}

/** Original52a280 applies each property before forwarding its received observer.
 * Reception leaves outgoing pending bits and serialization snapshots unchanged.
 * Earlier writes remain applied when a later segment fails.
 */
export function receiveRoleNumericProperties(
  fields: Map<number, number>,
  segments: readonly Uint8Array[],
  context: number,
  received?: (index: RoleNumericPropertyIndex, context: number) => void,
): boolean {
  for (const segment of segments) {
    const index = segment[1];
    if (segment[0] !== 1 || (index !== 5 && index !== 8 && index !== 12 && index !== 13) || segment.length < 8) {
      return false;
    }
    const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
    if (view.getUint16(2) !== 4) return false;
    fields.set(FIELDS[index], index === 8 ? view.getUint32(4) : view.getInt32(4));
    received?.(index, context >>> 0);
  }
  return true;
}
