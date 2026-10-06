import type {OwnedRoleBaseRecord} from '../../../apps/shared/contracts/owned-base';

/** Original41e5f1: the name reader occurs between numeric prefix and equipment tail. */
export function readOwnedRoleBaseRecord(reader: {
  unsigned(width: 16 | 32): number;
  name(): string;
}): OwnedRoleBaseRecord {
  const fields = new Map<number, number>();
  const read = (offset: number, width: 16 | 32): void => {
    const value = reader.unsigned(width);
    fields.set(offset, width === 16 ? value & 0xffff : value >>> 0);
  };
  read(4, 32);
  read(0, 32);
  for (const offset of [8, 0x84, 0x34, 0x38, 0x8c, 0x80, 0x88, 0x7c,
    0x3c, 0x40, 0x2c, 0x30, 0x94, 0x28, 0x90]) read(offset, 16);
  const name = reader.name();
  for (let slot = 0; slot < 6; slot++) {
    read(0x44 + slot * 4, 32);
    read(0x5c + slot * 4, 32);
  }
  read(0x74, 32);
  read(0x78, 32);
  return {fields, name};
}

/** Original4334e8 copies this owned record field to OdlPlayer MaxHP. */
export function ownedRoleBaseMaxHp(record: OwnedRoleBaseRecord): number {
  return record.fields.get(0x2c)! | 0;
}

/** Original401fa6 name: uint32 byte count followed by unaligned byte reads. */
export function readOwnedRoleBasePacket(
  bytes: Uint8Array,
  startBit: number,
  decodeName: (bytes: Uint8Array) => string,
): {record: OwnedRoleBaseRecord; endBit: number; nameBytes: Uint8Array} {
  let cursor = startBit;
  const unsigned = (width: number): number => {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      const byte = bytes[cursor >>> 3];
      if (byte === undefined) throw new RangeError('Incomplete owned base record');
      value += ((byte >>> (cursor & 7)) & 1) * 2 ** bit;
    }
    return value;
  };
  let nameBytes = new Uint8Array();
  const record = readOwnedRoleBaseRecord({unsigned, name: () => {
    const count = unsigned(32);
    nameBytes = new Uint8Array(count);
    for (let index = 0; index < count; index++) nameBytes[index] = unsigned(8);
    return decodeName(nameBytes);
  }});
  return {record, endBit: cursor, nameBytes};
}

/** Original41f23c replaces the index; duplicate instance IDs keep the first record. */
export function receiveOwnedRoleBaseBatch(
  records: Map<number, OwnedRoleBaseRecord>,
  bytes: Uint8Array,
  startBit: number,
  decodeName: (bytes: Uint8Array) => string,
): number {
  records.clear();
  let count = 0;
  let cursor = startBit;
  for (let bit = 0; bit < 32; bit++, cursor++) {
    const byte = bytes[cursor >>> 3];
    if (byte === undefined) throw new RangeError('Incomplete owned base batch');
    count += ((byte >>> (cursor & 7)) & 1) * 2 ** bit;
  }
  for (let index = 0; index < count; index++) {
    const parsed = readOwnedRoleBasePacket(bytes, cursor, decodeName);
    cursor = parsed.endBit;
    const key = parsed.record.fields.get(0)! >>> 0;
    if (!records.has(key)) records.set(key, parsed.record);
  }
  return cursor;
}

/** Original520819 (type4078): replace owned records, then read message+1c. */
export function receiveOwnedRoleBaseMessage(
  records: Map<number, OwnedRoleBaseRecord>,
  bytes: Uint8Array,
  startBit: number,
  decodeName: (bytes: Uint8Array) => string,
): {field1c: number; endBit: number} {
  let cursor = receiveOwnedRoleBaseBatch(records, bytes, startBit, decodeName);
  let field1c = 0;
  for (let bit = 0; bit < 32; bit++, cursor++) {
    const byte = bytes[cursor >>> 3];
    if (byte === undefined) throw new RangeError('Incomplete owned base message');
    field1c += ((byte >>> (cursor & 7)) & 1) * 2 ** bit;
  }
  return {field1c, endBit: cursor};
}
