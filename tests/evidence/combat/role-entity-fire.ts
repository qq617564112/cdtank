export const ROLE_ENTITY_FIRE_MESSAGE_TYPE = 0x3a9d;
export const ROLE_ENTITY_FIRE_BODY_BITS = 352;

/** Original422d90 writes nine DWORDs; float fields keep their raw float32 bits. */
export interface RoleEntityFireSnapshot {
  readonly field00: number;
  readonly field04: number;
  readonly xBits: number;
  readonly zBits: number;
  readonly direction10: number;
  readonly direction14: number;
  readonly secondsBits: number;
  /** Snapshot+1c/+20 are retained memory, omitted by both native codecs. */
  readonly field1cBits: number;
  readonly field20Bits: number;
}

export interface RoleEntityFireRequest {
  readonly targetObjectId: number;
  readonly actor: RoleEntityFireSnapshot;
  readonly target: RoleEntityFireSnapshot;
}

export interface RoleEntityFirePreservedTail {
  readonly actorTailBits: readonly [number, number];
  readonly targetTailBits: readonly [number, number];
}

function copySnapshot(snapshot: RoleEntityFireSnapshot): RoleEntityFireSnapshot {
  return {
    field00: snapshot.field00 >>> 0, field04: snapshot.field04 >>> 0,
    xBits: snapshot.xBits >>> 0, zBits: snapshot.zBits >>> 0,
    direction10: snapshot.direction10 >>> 0, direction14: snapshot.direction14 >>> 0,
    secondsBits: snapshot.secondsBits >>> 0,
    field1cBits: snapshot.field1cBits >>> 0, field20Bits: snapshot.field20Bits >>> 0,
  };
}

/** Original428ad9–428b0a request body; callers supply both complete snapshots. */
export function createRoleEntityFireRequest(targetObjectId: number,
  actor: RoleEntityFireSnapshot, target: RoleEntityFireSnapshot): RoleEntityFireRequest {
  return {targetObjectId: targetObjectId >>> 0, actor: copySnapshot(actor), target: copySnapshot(target)};
}

function validateOffset(startBit: number): void {
  if (!Number.isSafeInteger(startBit) || startBit < 0) {
    throw new RangeError('Invalid entity-fire bit offset');
  }
}

/** Original42531d/41d8c9: target DWORD followed by two160-bit snapshot bodies. */
export function encodeRoleEntityFireRequest(request: RoleEntityFireRequest, startBit = 0): Uint8Array {
  validateOffset(startBit);
  const bytes = new Uint8Array(Math.ceil((startBit + ROLE_ENTITY_FIRE_BODY_BITS) / 8));
  let position = startBit;
  const write = (value: number, width: number): void => {
    for (let bit = 0; bit < width; bit++, position++) {
      bytes[position >>> 3] |= ((value >>> bit) & 1) << (position & 7);
    }
  };
  write(request.targetObjectId, 32);
  for (const snapshot of [request.actor, request.target]) {
    write(snapshot.xBits, 32);
    write(snapshot.zBits, 32);
    write(snapshot.direction14, 16);
    write(snapshot.direction10, 16);
    write(snapshot.field00, 16);
    write(snapshot.field04, 16);
    write(snapshot.secondsBits, 32);
  }
  return bytes;
}

/** Original425353/41d84c leaves snapshot+1c/+20 untouched; preserved bits are required. */
export function decodeRoleEntityFireRequest(bytes: Uint8Array,
  preserved: RoleEntityFirePreservedTail, startBit = 0): RoleEntityFireRequest {
  validateOffset(startBit);
  if (startBit + ROLE_ENTITY_FIRE_BODY_BITS > bytes.length * 8) {
    throw new RangeError('Incomplete entity-fire payload');
  }
  let position = startBit;
  const read = (width: number): number => {
    let value = 0;
    for (let bit = 0; bit < width; bit++, position++) {
      value |= ((bytes[position >>> 3] >>> (position & 7)) & 1) << bit;
    }
    return value >>> 0;
  };
  const snapshot = (tail: readonly [number, number]): RoleEntityFireSnapshot => {
    const xBits = read(32);
    const zBits = read(32);
    const direction14 = read(16);
    const direction10 = read(16);
    const field00 = read(16);
    const field04 = read(16);
    const secondsBits = read(32);
    return {field00, field04, xBits, zBits, direction10, direction14, secondsBits,
      field1cBits: tail[0] >>> 0, field20Bits: tail[1] >>> 0};
  };
  const targetObjectId = read(32);
  const actor = snapshot(preserved.actorTailBits);
  const target = snapshot(preserved.targetTailBits);
  return {targetObjectId, actor, target};
}
