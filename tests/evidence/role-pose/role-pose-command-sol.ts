export const ROLE_POSE_COMMAND_TYPE = 0x3aa6;
const HALF_DEGREE_RADIANS = Math.fround(Math.PI / 360);
export type RolePoseVector = readonly [number, number, number];

/** Original command-vector element; clock is raw +0x18, outside the pose setter. */
export interface RolePoseCommand {
  roleId: number;
  command: number;
  state: number;
  x: number;
  z: number;
  lookHalfDegrees: number;
  forwardHalfDegrees: number;
  clock: number;
}

function copyBits(bytes: Uint8Array, startBit: number, length: number): Uint8Array {
  if (startBit + length * 8 > bytes.length * 8) {
    throw new RangeError('Incomplete role pose command payload');
  }
  const result = new Uint8Array(length);
  for (let bit = 0; bit < length * 8; bit++) {
    const source = startBit + bit;
    result[bit >>> 3] |= ((bytes[source >>> 3] >>> (source & 7)) & 1) << (bit & 7);
  }
  return result;
}

/** Original41de69: count32 followed by 192 bits per command, LSB-first. */
export function encodeRolePoseCommands(commands: readonly RolePoseCommand[], startBit = 0): Uint8Array {
  const raw = new Uint8Array(4 + commands.length * 24);
  const view = new DataView(raw.buffer);
  view.setUint32(0, commands.length, true);
  commands.forEach((command, index) => {
    const offset = 4 + index * 24;
    view.setUint32(offset, command.roleId, true);
    view.setFloat32(offset + 4, command.x, true);
    view.setFloat32(offset + 8, command.z, true);
    view.setUint16(offset + 12, command.forwardHalfDegrees, true);
    view.setUint16(offset + 14, command.lookHalfDegrees, true);
    view.setUint16(offset + 16, command.command, true);
    view.setUint16(offset + 18, command.state, true);
    view.setFloat32(offset + 20, command.clock, true);
  });
  const output = new Uint8Array(Math.ceil((startBit + raw.length * 8) / 8));
  for (let bit = 0; bit < raw.length * 8; bit++) {
    const target = startBit + bit;
    output[target >>> 3] |= ((raw[bit >>> 3] >>> (bit & 7)) & 1) << (target & 7);
  }
  return output;
}

export function decodeRolePoseCommands(bytes: Uint8Array, startBit = 0): RolePoseCommand[] {
  const count = new DataView(copyBits(bytes, startBit, 4).buffer).getUint32(0, true);
  const view = new DataView(copyBits(bytes, startBit + 32, count * 24).buffer);
  return Array.from({length: count}, (_, index) => {
    const offset = index * 24;
    return {roleId: view.getUint32(offset, true), x: view.getFloat32(offset + 4, true),
      z: view.getFloat32(offset + 8, true), forwardHalfDegrees: view.getUint16(offset + 12, true),
      lookHalfDegrees: view.getUint16(offset + 14, true), command: view.getUint16(offset + 16, true),
      state: view.getUint16(offset + 18, true), clock: view.getFloat32(offset + 20, true)};
  });
}

/** Original41d7e3/57454b: signed angle units rotate +X toward +Z around +Y. */
export function rolePoseHalfDegreeVector(angle: number): RolePoseVector {
  const radians = Math.fround((angle | 0) * HALF_DEGREE_RADIANS);
  return [Math.fround(Math.cos(radians)), 0, Math.fround(Math.sin(radians))];
}

export interface RolePoseCommandSource {
  rolePresent: boolean;
  actorPresent: boolean;
  /** Original record+0x90, separate from the tank definition or actor class. */
  roleState: number;
  /** Existing role+0x260; command-vector messages carry no Y coordinate. */
  roleY: number;
  actorTargetBlocked: boolean;
}

export interface RolePoseCommandDispatch {
  mode: 'none' | 'target' | 'immediate';
  position: RolePoseVector;
  forward: RolePoseVector;
  look: RolePoseVector;
}

/** Pose portion of remote42823e→42298b/4229cd; outer state bookkeeping remains separate. */
export function dispatchRolePoseCommand(command: RolePoseCommand,
  source: RolePoseCommandSource): RolePoseCommandDispatch {
  let mode: RolePoseCommandDispatch['mode'] = 'none';
  if (source.rolePresent && source.actorPresent) {
    if (command.state === 0 || command.state === 1) {
      mode = 'immediate';
    } else if (source.roleState === 2 && !source.actorTargetBlocked) {
      mode = 'target';
    }
  }
  return {mode, position: [Math.fround(command.x), Math.fround(source.roleY), Math.fround(command.z)],
    forward: rolePoseHalfDegreeVector(command.forwardHalfDegrees),
    look: rolePoseHalfDegreeVector(command.lookHalfDegrees)};
}
