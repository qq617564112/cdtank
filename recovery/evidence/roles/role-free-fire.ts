import type {RoleCombatState} from '../../../apps/server/src/battle/roles/combat-state';
import type {RoleFreeFireRequest, RoleFireVector} from '../../../apps/server/src/battle/roles/free-aim';
import {createRoleFreeAim} from '../../../apps/server/src/battle/roles/free-aim';

export const ROLE_FREE_FIRE_MESSAGE_TYPE = 0x3a9b;

/** Original4288fe free-target branch; request generation does not consume bullets. */
export function requestRoleFreeFire(role: RoleCombatState | undefined, context: {
  local: boolean; stage: number; controllerPresent: boolean; sceneReady: boolean;
  position: RoleFireVector; direction: RoleFireVector; currentSeconds: number;
}, handlers: {aim(point: RoleFireVector): void; send(request: RoleFreeFireRequest): void; fire(): void}): void {
  if (!role || !context.local) return;
  role.specialFlag12 = 0;
  if (role.status !== 2 || context.stage !== 4 || !context.controllerPresent || !context.sceneReady) return;
  const request = createRoleFreeAim(context.position, context.direction, context.currentSeconds);
  handlers.aim({x: request.x, y: request.y, z: request.z});
  handlers.send(request);
  handlers.fire();
}

/** Original492a89: four raw float32 values, least-significant bit first. */
export function encodeRoleFreeFire(request: RoleFreeFireRequest, startBit = 0): Uint8Array {
  const source = new Uint8Array(16);
  const view = new DataView(source.buffer);
  [request.x, request.y, request.z, request.seconds].forEach((value, index) => view.setFloat32(index * 4, value, true));
  const bytes = new Uint8Array(Math.ceil((startBit + 128) / 8));
  for (let bit = 0; bit < 128; bit++) {
    const destination = startBit + bit;
    bytes[destination >>> 3] |= ((source[bit >>> 3] >>> (bit & 7)) & 1) << (destination & 7);
  }
  return bytes;
}

/** Original4258b8 clears each destination then reads its raw32 bits. */
export function decodeRoleFreeFire(bytes: Uint8Array, startBit = 0): RoleFreeFireRequest {
  if (startBit + 128 > bytes.length * 8) throw new RangeError('Incomplete free-fire payload');
  const source = new Uint8Array(16);
  for (let bit = 0; bit < 128; bit++) {
    const position = startBit + bit;
    source[bit >>> 3] |= ((bytes[position >>> 3] >>> (position & 7)) & 1) << (bit & 7);
  }
  const view = new DataView(source.buffer);
  return {x: view.getFloat32(0, true), y: view.getFloat32(4, true),
    z: view.getFloat32(8, true), seconds: view.getFloat32(12, true)};
}
