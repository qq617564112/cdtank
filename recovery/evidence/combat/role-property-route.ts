export interface RolePropertyRouteHandlers {
  command3: () => unknown;
  properties: () => unknown;
  commands6To9: (command: number) => unknown;
}

/** Original52af80: handled commands return true regardless of the branch result. */
export function routeRolePropertyMessage(
  objectId: number,
  messageObjectId: number,
  command: number,
  handlers: RolePropertyRouteHandlers,
): boolean {
  if ((objectId >>> 0) !== (messageObjectId >>> 0)) return false;
  const opcode = command & 0xff;
  if (opcode === 3) handlers.command3();
  else if (opcode === 5) handlers.properties();
  else if (opcode >= 6 && opcode <= 9) handlers.commands6To9(opcode);
  else return false;
  return true;
}

/** Original525630/525730/525830: lookup object key, match record type, then route. */
export function routeRegisteredRolePropertyMessage<T extends {type: number}>(
  registry: ReadonlyMap<number, T>,
  messageObjectId: number,
  messageType: number,
  route: (record: T) => boolean,
): boolean {
  const record = registry.get(messageObjectId >>> 0);
  if (!record || (record.type & 0xffff) !== (messageType & 0xffff)) return false;
  return route(record);
}
