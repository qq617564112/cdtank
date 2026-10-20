import type {RoomState} from '../../rooms/state';

/** Small server diagnostic projection, separate from network snapshots. */
export function collectCpuTrace(room: RoomState, at: number) {
  const position = (value: {x: number; y: number; z: number}) =>
    ({x: value.x, y: value.y, z: value.z});
  const objects = new Map([...room.objectives, ...room.sceneObjects].map(value => [value.id, value]));
  return {at, roomId: room.roomId, round: room.round, mapId: room.map.mapId,
    mode: room.mode, phase: room.phase, startedAt: room.startedAt, tick: room.tick,
    navigationRevision: room.battlefield.navigationRevision,
    tanks: [...room.players.values()].map(player => {
      const controller = player.cpu ?? player.autopilot;
      const decision = controller?.traceState();
      const target = decision?.targetId
        ? room.players.get(decision.targetId) ?? objects.get(decision.targetId) : undefined;
      const attack = decision?.attackId ? objects.get(decision.attackId) : undefined;
      const input = player.input;
      return {id: player.id, name: player.name, team: player.team, tankId: player.tank.id,
        control: player.cpu ? 'CPU' as const : player.autopilot ? 'AUTOPILOT' as const : 'HUMAN' as const,
        ...position(player), yaw: player.yaw, bodyYaw: player.bodyYaw, aim: player.aim,
        alive: player.alive, hp: player.hp, deaths: player.deaths,
        damageTaken: player.roundStats?.damageTaken ?? 0,
        shots: player.roundStats?.shots ?? 0, hits: player.roundStats?.hits ?? 0,
        damageDealt: player.roundStats?.damage ?? 0,
        status: player.combat.status, movementFlags: [8, 9, 10].map(index => player.combat.getFlag(index)),
        movementCommand: player.movementCommand, disguised: !!player.roleDisguise,
        camouflaged: !!player.opticalCamouflage,
        input: {sequence: input.sequence, move: input.move, turn: input.turn,
          aim: input.aim, fire: input.fire, useItem: input.useItem},
        decision, target: target ? {id: target.id, hp: target.hp, ...position(target)} : undefined,
        breach: attack ? {id: attack.id, hp: attack.hp, ...position(attack)} : undefined};
    })};
}

export type CpuTraceSnapshot = ReturnType<typeof collectCpuTrace>;
