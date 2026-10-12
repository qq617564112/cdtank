import {readOwnedRoleBasePacket, receiveOwnedRoleBaseBatch} from './role-owned-base';
import type {OwnedRoleBaseRecord} from '../../../apps/shared/contracts/owned-base';
import {readOwnedRoleEquipmentPacket, receiveOwnedRoleEquipmentBatch} from './role-owned-equipment';
import type {OwnedRoleEquipmentRecord} from '../../../apps/shared/contracts/owned-equipment';

/** Original42d6a5 (type3aab): first source, second source, then42d6cd byte array. */
export function receiveOwnedRoleSourcesMessage(
  baseRecords: Map<number, OwnedRoleBaseRecord>,
  equipmentRecords: Map<number, OwnedRoleEquipmentRecord>,
  bytes: Uint8Array,
  startBit: number,
  streamCapacity: number,
  decodeName: (bytes: Uint8Array) => string,
): {additionalLength: number; additional: Uint8Array | undefined; endBit: number} {
  let cursor = receiveOwnedRoleBaseBatch(baseRecords, bytes, startBit, decodeName);
  cursor = receiveOwnedRoleEquipmentBatch(equipmentRecords, bytes, cursor, decodeName);
  const unsigned = (width: number): number => {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      const byte = bytes[cursor >>> 3];
      if (byte === undefined) throw new RangeError('Incomplete owned sources message');
      value += ((byte >>> (cursor & 7)) & 1) * 2 ** bit;
    }
    return value;
  };
  const additionalLength = unsigned(32);
  // Original42d6cd leaves existing bytes intact on its capacity diagnostic branch.
  if (additionalLength !== 0 && additionalLength >= streamCapacity) {
    return {additionalLength, additional: undefined, endBit: cursor};
  }
  const additional = new Uint8Array(additionalLength);
  for (let index = 0; index < additionalLength; index++) additional[index] = unsigned(8);
  return {additionalLength, additional, endBit: cursor};
}

/** Original42ccd9 (type3aa5) reads one second-source record then one first-source record. */
export function readOwnedRolePairMessage(bytes: Uint8Array, startBit: number,
    decodeName: (bytes: Uint8Array) => string): {
  equipment: OwnedRoleEquipmentRecord; base: OwnedRoleBaseRecord; endBit: number;
} {
  const equipment = readOwnedRoleEquipmentPacket(bytes, startBit, decodeName);
  const base = readOwnedRoleBasePacket(bytes, equipment.endBit, decodeName);
  return {equipment: equipment.record, base: base.record, endBit: base.endBit};
}
