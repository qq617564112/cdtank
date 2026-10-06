import type {OwnedRoleEquipmentRecord} from '../../../apps/shared/contracts/owned-equipment';

/** Original421afe: field widths and order, including the packed final flags. */
export const ownedRoleEquipmentFields: readonly (readonly [number, number])[] = [
  [0x68, 32], [0x58, 32], [0x5c, 32], [0x60, 32], [0x64, 32], [0x20, 32],
  [0x3c, 16], [0x40, 16], [0x44, 16], [0x4c, 16], [0x50, 16], [0x54, 16],
  [0x34, 32], [0x1c, 32], [0x24, 32], [0x28, 32], [0x2c, 32], [0x30, 32],
  [0x6c, 6], [0x38, 1], [0x48, 1],
];

/** Original421afe reads name first, then zero-extended numeric fields. */
export function readOwnedRoleEquipmentRecord(reader: {
  unsigned(width: number): number;
  name(): string;
}): OwnedRoleEquipmentRecord {
  const name = reader.name();
  const fields = new Map<number, number>();
  for (const [offset, width] of ownedRoleEquipmentFields) {
    fields.set(offset, reader.unsigned(width) >>> 0);
  }
  return {fields, name};
}

/** Original421afe complete record from its unaligned bitstream. */
export function readOwnedRoleEquipmentPacket(bytes: Uint8Array, startBit: number,
    decodeName: (bytes: Uint8Array) => string): {record: OwnedRoleEquipmentRecord; endBit: number} {
  let cursor = startBit;
  const unsigned = (width: number): number => {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      const byte = bytes[cursor >>> 3];
      if (byte === undefined) throw new RangeError('Incomplete owned equipment record');
      value += ((byte >>> (cursor & 7)) & 1) * 2 ** bit;
    }
    return value;
  };
  const record = readOwnedRoleEquipmentRecord({unsigned, name: () => {
    const nameBytes = new Uint8Array(unsigned(32));
    for (let index = 0; index < nameBytes.length; index++) nameBytes[index] = unsigned(8);
    return decodeName(nameBytes);
  }});
  return {record, endBit: cursor};
}

/** Original4225b4 clears the index and keeps the first record per field+1c key. */
export function receiveOwnedRoleEquipmentBatch(
  records: Map<number, OwnedRoleEquipmentRecord>,
  bytes: Uint8Array,
  startBit: number,
  decodeName: (bytes: Uint8Array) => string,
): number {
  let cursor = startBit;
  const unsigned = (width: number): number => {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      const byte = bytes[cursor >>> 3];
      if (byte === undefined) throw new RangeError('Incomplete owned equipment batch');
      value += ((byte >>> (cursor & 7)) & 1) * 2 ** bit;
    }
    return value;
  };
  records.clear();
  const count = unsigned(32);
  for (let index = 0; index < count; index++) {
    const parsed = readOwnedRoleEquipmentPacket(bytes, cursor, decodeName);
    cursor = parsed.endBit;
    const record = parsed.record;
    const key = record.fields.get(0x1c)!;
    if (!records.has(key)) records.set(key, record);
  }
  return cursor;
}
