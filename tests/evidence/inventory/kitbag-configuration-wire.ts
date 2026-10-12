import type {KitbagAssignmentResult, KitbagCancellationResult} from '../../../apps/server/src/accounts/kitbag-configuration';

export const KITBAG_ASSIGNMENT_MESSAGE_TYPE = 0x3c91;
export const KITBAG_CANCELLATION_MESSAGE_TYPE = 0x3c9a;

function encode(values: readonly number[], widths: readonly number[], startBit: number): Uint8Array {
  const bytes = new Uint8Array(Math.ceil((startBit + widths.reduce((sum, width) => sum + width, 0)) / 8));
  let cursor = startBit;
  for (let field = 0; field < widths.length; field++) {
    for (let bit = 0; bit < widths[field]; bit++, cursor++) {
      bytes[cursor >>> 3] |= ((values[field] >>> bit) & 1) << (cursor & 7);
    }
  }
  return bytes;
}

function decode(bytes: Uint8Array, widths: readonly number[], startBit: number): number[] {
  if (startBit + widths.reduce((sum, width) => sum + width, 0) > bytes.length * 8) {
    throw new RangeError('Incomplete kitbag configuration payload');
  }
  let cursor = startBit;
  return widths.map(width => {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      value |= ((bytes[cursor >>> 3] >>> (cursor & 7)) & 1) << bit;
    }
    return value >>> 0;
  });
}

const ASSIGNMENT_WIDTHS = [8, 32, 8, 32, 32, 32, 32, 32, 32, 32];

/** Original43c657; all fields required, no request constructor defaults assumed. */
export function encodeKitbagAssignment(message: KitbagAssignmentResult, startBit = 0): Uint8Array {
  if (message.hotkeys.length !== 7) throw new RangeError('Kitbag assignment requires seven hotkeys');
  return encode([message.result, message.instanceId, message.slot, ...message.hotkeys], ASSIGNMENT_WIDTHS, startBit);
}

/** Original43c6c1 body,272 bits. */
export function decodeKitbagAssignment(bytes: Uint8Array, startBit = 0): KitbagAssignmentResult {
  const [result, instanceId, slot, ...hotkeys] = decode(bytes, ASSIGNMENT_WIDTHS, startBit);
  return {result, instanceId, slot, hotkeys};
}

/** Original499757 body,16 bits. */
export function encodeKitbagCancellation(message: KitbagCancellationResult, startBit = 0): Uint8Array {
  return encode([message.slot, message.result], [8, 8], startBit);
}

/** Original43c76f zeroes each destination before reading its eight bits. */
export function decodeKitbagCancellation(bytes: Uint8Array, startBit = 0): KitbagCancellationResult {
  const [slot, result] = decode(bytes, [8, 8], startBit);
  return {slot, result};
}
