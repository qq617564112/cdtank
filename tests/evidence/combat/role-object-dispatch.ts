export interface RoleObjectMessage {
  category: number;
  recipient: number;
  objectId: number;
  command: number;
}

export interface RoleObjectDispatchHandlers {
  mode2Contains(objectId: number): boolean;
  command1(): boolean;
  create(): boolean;
  remove(): boolean;
  mode2(): boolean;
  all(): boolean;
  mode1(): boolean;
}

/** Original525520 gate and5282e0 command table. */
export function dispatchRoleObjectMessage(
  message: RoleObjectMessage,
  handlers: RoleObjectDispatchHandlers,
): boolean {
  const command = message.command & 0xff;
  if ((message.category & 0xff) !== 3) return false;
  if ((message.recipient >>> 0) === 0xfffffffe && command === 5
    && !handlers.mode2Contains(message.objectId >>> 0)) return false;
  switch (command) {
    case 1: return handlers.command1();
    case 2: return true;
    case 3: return handlers.create();
    case 4: return handlers.remove();
    case 5: case 9: return handlers.mode2();
    case 6: return handlers.all();
    case 7: case 8: return handlers.mode1();
    default: return false;
  }
}
