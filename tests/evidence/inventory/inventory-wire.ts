import type {InventoryWireRecord} from '../../../apps/shared/protocols/PtlInventory';

export const INVENTORY_RECORD_BITS = 224;
export const INVENTORY_QUERY_MESSAGE_TYPE = 0x3c8f;
export const KITBAG_DELETION_MESSAGE_TYPE = 0x3c92;

export interface InventoryQueryPacket {
  /** Original packet+0x0c; business meaning remains unconfirmed. */
  fieldC: number;
  records: InventoryWireRecord[];
}

function writeUnsigned(bytes: Uint8Array, value: number, startBit: number, width: number): void {
  for (let bit = 0; bit < width; bit++) {
    const cursor = startBit + bit;
    bytes[cursor >>> 3] |= ((value >>> bit) & 1) << (cursor & 7);
  }
}

function readUnsigned(bytes: Uint8Array, startBit: number, width: number): number {
  if (startBit + width > bytes.length * 8) throw new RangeError('Incomplete inventory payload');
  let value = 0;
  for (let bit = 0; bit < width; bit++) {
    const cursor = startBit + bit;
    value |= ((bytes[cursor >>> 3] >>> (cursor & 7)) & 1) << bit;
  }
  return value >>> 0;
}

function orderedRecords(records: readonly InventoryWireRecord[]): InventoryWireRecord[] {
  const instances = new Map<number, InventoryWireRecord>();
  for (const record of records) {
    const id = record.instanceId >>> 0;
    if (!instances.has(id)) instances.set(id, record);
  }
  return [...instances.entries()].sort(([a], [b]) => a - b).map(([, record]) => record);
}

/** Original43f42d including unsigned tree ordering and first duplicate retained. */
export function decodeInventoryQuery(bytes: Uint8Array, startBit = 0): InventoryQueryPacket {
  const fieldC = readUnsigned(bytes, startBit, 32);
  const count = readUnsigned(bytes, startBit + 32, 16);
  const records: InventoryWireRecord[] = [];
  for (let index = 0; index < count; index++) {
    records.push(decodeInventoryRecord(bytes, startBit + 48 + index * INVENTORY_RECORD_BITS));
  }
  return {fieldC, records: orderedRecords(records)};
}

/** Original43f3cf serializes the unique tree in ascending unsigned instance order. */
export function encodeInventoryQuery(packet: InventoryQueryPacket, startBit = 0): Uint8Array {
  const records = orderedRecords(packet.records);
  const bytes = new Uint8Array(Math.ceil((startBit + 48 + records.length * INVENTORY_RECORD_BITS) / 8));
  writeUnsigned(bytes, packet.fieldC, startBit, 32);
  writeUnsigned(bytes, records.length, startBit + 32, 16);
  let cursor = startBit + 48;
  for (const record of records) {
    for (const [field, width] of FIELDS) {
      writeUnsigned(bytes, record[field], cursor, width);
      cursor += width;
    }
  }
  return bytes;
}

/** Original42571f payload; excludes the separately routed message type. */
export function encodeKitbagDeletion(instanceId: number, startBit = 0): Uint8Array {
  const bytes = new Uint8Array(Math.ceil((startBit + 32) / 8));
  for (let bit = 0; bit < 32; bit++) {
    const cursor = startBit + bit;
    bytes[cursor >>> 3] |= ((instanceId >>> bit) & 1) << (cursor & 7);
  }
  return bytes;
}

/** Original425ba6 reads the sole32-bit field at packet+0x0c. */
export function decodeKitbagDeletion(bytes: Uint8Array, startBit = 0): number {
  if (startBit + 32 > bytes.length * 8) throw new RangeError('Incomplete kitbag deletion');
  let value = 0;
  for (let bit = 0; bit < 32; bit++) {
    const cursor = startBit + bit;
    value |= ((bytes[cursor >>> 3] >>> (cursor & 7)) & 1) << bit;
  }
  return value >>> 0;
}

const FIELDS = [
  ['instanceId', 32], ['field8', 32], ['itemTableId', 16], ['ownedQuantity', 24],
  ['float24Bits', 32], ['float28Bits', 32], ['float2cBits', 32], ['battleQuantity', 24],
] as const;

/** Original42dddd, LSB-first stream; high bits beyond each width are discarded. */
export function encodeInventoryRecord(record: InventoryWireRecord, startBit = 0): Uint8Array {
  const bytes = new Uint8Array(Math.ceil((startBit + INVENTORY_RECORD_BITS) / 8));
  let cursor = startBit;
  for (const [field, width] of FIELDS) {
    const value = record[field] >>> 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      bytes[cursor >>> 3] |= ((value >>> bit) & 1) << (cursor & 7);
    }
  }
  return bytes;
}

/** Original43bcb5 constructor then42e0b7 read; state is not transmitted. */
export function decodeInventoryRecord(bytes: Uint8Array, startBit = 0): InventoryWireRecord {
  if (startBit + INVENTORY_RECORD_BITS > bytes.length * 8) {
    throw new RangeError('Incomplete inventory record');
  }
  const record: InventoryWireRecord = {instanceId: 0, field8: 0, itemTableId: 0,
    ownedQuantity: 0, battleQuantity: 0, state: 0,
    float24Bits: 0, float28Bits: 0, float2cBits: 0};
  let cursor = startBit;
  for (const [field, width] of FIELDS) {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      value |= ((bytes[cursor >>> 3] >>> (cursor & 7)) & 1) << bit;
    }
    record[field] = value >>> 0;
  }
  return record;
}
