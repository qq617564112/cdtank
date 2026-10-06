export interface RoleNetworkMessage {
  bytes: Uint8Array;
  payload: Uint8Array;
  metadataType: number;
  recipient: number;
  type: number;
  objectId: number;
  context: number;
  category: number;
  command: number;
  propertyCount: number;
}

/** Original53d9c0 copies a complete packet and replaces its payload length. */
export function readRoleNetworkMessage(raw: Uint8Array): RoleNetworkMessage {
  const bytes = raw.slice();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint16(2, (bytes.length - 32) & 0xffff, false);
  return {
    bytes, payload: bytes.subarray(32),
    metadataType: view.getUint32(4, false),
    recipient: view.getUint32(8, false),
    type: view.getUint16(12, false),
    objectId: view.getUint32(16, false),
    context: view.getUint32(20, false),
    category: bytes[29]!, command: bytes[30]!, propertyCount: bytes[31]!,
  };
}

/** Original53ee60 dispatches by category after the special-recipient state gate. */
export function dispatchRoleNetworkMessage(
  message: Pick<RoleNetworkMessage, 'recipient' | 'category'>,
  networkState: () => number,
  handlers: {category1(): void; category2(): void; category3(): void},
): void {
  if ((message.recipient >>> 0) === 0xfffffffe && networkState() !== 3) return;
  switch (message.category & 0xff) {
    case 1: handlers.category1(); break;
    case 2: handlers.category2(); break;
    case 3: handlers.category3(); break;
  }
}
