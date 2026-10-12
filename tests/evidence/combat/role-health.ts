import type {RoleHealthRecord} from '../../../apps/server/src/battle/roles/health';
export type {RoleHealthRecord} from '../../../apps/server/src/battle/roles/health';

export const ROLE_HP_PROPERTY_INDEX = 12;
export const ROLE_MAX_HP_PROPERTY_INDEX = 13;

/** Original545f10 numeric segment: category, index, BE payload size, BE signed32. */
export function encodeRoleHealthProperty(
  index: typeof ROLE_HP_PROPERTY_INDEX | typeof ROLE_MAX_HP_PROPERTY_INDEX,
  bits: number,
): Uint8Array {
  const bytes = new Uint8Array(8);
  bytes[0] = 1;
  bytes[1] = index;
  const view = new DataView(bytes.buffer);
  view.setUint16(2, 4);
  view.setInt32(4, bits | 0);
  return bytes;
}

/** Bound property545d40 copies four bytes directly; owner notification is separate. */
export function applyRoleHealthProperty(
  record: RoleHealthRecord,
  index: number,
  bits: number,
): boolean {
  if (index === ROLE_HP_PROPERTY_INDEX) record.hp = bits | 0;
  else if (index === ROLE_MAX_HP_PROPERTY_INDEX) record.maxHp = bits | 0;
  else return false;
  return true;
}

/** Original52a280 numeric health reception: apply and notify each segment in order. */
export function receiveRoleHealthProperties(
  record: RoleHealthRecord,
  segments: readonly Uint8Array[],
  context: number,
  received?: (index: 12 | 13, context: number) => void,
): boolean {
  for (const segment of segments) {
    const index = segment[1];
    if (segment[0] !== 1 || (index !== 12 && index !== 13) || segment.length < 8) {
      return false;
    }
    const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
    if (view.getUint16(2) !== 4) return false;
    applyRoleHealthProperty(record, index, view.getInt32(4));
    received?.(index, context >>> 0);
  }
  return true;
}

