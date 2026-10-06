/** Dedicated acceptance-process observer. Never imported by formal runtime. */
import {appendFileSync} from 'node:fs';
import {Battlefield, segmentBox} from '../../apps/server/src/battlefield';
import {getSceneBreakables} from '../../apps/server/src/scene-objects';
import {World} from '../../apps/server/src/world';
import type {RoomState} from '../../apps/server/src/rooms/state';

const tracePath = process.env.CDTANK_BREACH_TRACE ?? process.env.CDTANK_BREACH21_TRACE;
if (tracePath) {
  const active = new WeakMap<Battlefield, Set<string>>();
  const written = new Set<string>();
  const emit = (key: string, record: object) => {
    if (written.has(key)) return;
    written.add(key); appendFileSync(tracePath, JSON.stringify(record) + '\n');
  };
  const setDynamicBox = Battlefield.prototype.setDynamicBox;
  Battlefield.prototype.setDynamicBox = function(box, id) {
    const result = setDynamicBox.call(this, box, id);
    let ids = active.get(this);
    if (!ids) {ids = new Set(); active.set(this, ids);}
    if (box) ids.add(id); else ids.delete(id);
    return result;
  };
  const leave = World.prototype.leave;
  World.prototype.leave = function(...args) {
    const rooms = (this as unknown as {rooms: ReadonlyMap<string, RoomState>}).rooms;
    const previous = [...rooms.values()].filter(r => [20, 21].includes(r.map.mapId) && r.mode === 5);
    const result = leave.apply(this, args);
    for (const room of previous) {
      if (rooms.has(room.roomId)) continue;
      emit(room.roomId + ':deleted', {kind: 'roomLeaveCleanup', roomId: room.roomId,
        round: room.round, removed: true, activeDynamicBoxes: active.get(room.battlefield)?.size ?? 0});
    }
    return result;
  };
  const step = World.prototype.step;
  World.prototype.step = function(deltaMs) {
    // Access is read-only; the observer never writes rooms, actors, input or time.
    const rooms = (this as unknown as {rooms: ReadonlyMap<string, RoomState>}).rooms;
    const before = new Map([...rooms.values()].filter(r => [20, 21].includes(r.map.mapId) && r.mode === 5)
      .map(r => [r.roomId, new Map(r.bullets.map(b => [b.id, {...b}]))]));
    const result = step.call(this, deltaMs);
    for (const room of rooms.values()) {
      if (![20, 21].includes(room.map.mapId) || room.mode !== 5) continue;
      const ids = active.get(room.battlefield) ?? new Set<string>();
      const sources = getSceneBreakables(room.map.mapId).filter(s => room.map.mapId === 21 || ['obj05460', 'obj05461', 'obj05462', 'obj05442'].includes(s.model));
      const context = {mapId: room.map.mapId, roomId: room.roomId, round: room.round, tick: room.tick, serverTime: result.snapshots.find(s => s.roomId === room.roomId)?.serverTime, observedAt: Date.now()};
      for (const objective of room.objectives) {
        const source = sources.find(s => s.id === objective.sourcePlacementId);
        if (!source) continue;
        const covered = ids.has(objective.id);
        const phase = objective.hp > 0 ? 'INTACT' : covered ? 'FADING' : 'RELEASED';
        const key = room.roomId + ':' + room.round + ':' + objective.id;
        const center = {x: source.matrix[12], y: source.matrix[13], z: source.matrix[14]};
        emit(key + ':' + phase, {...context, kind: 'collisionPhase', targetId: objective.id,
          placementId: source.id, hp: objective.hp, destroyedAt: objective.destroyedAt,
          phase, covered, navigationRevision: room.battlefield.navigationRevision,
          navigation: room.battlefield.navigation.sample(center.x, center.z),
          boxHit: room.battlefield.firstBoxHit(center, center, 0),
          matrix: source.matrix, dimensions: source.dimensions});
        if (phase !== 'RELEASED') continue;
        for (const player of room.players.values()) {
          if (!player.alive) continue;
          const point = {x: player.x, y: center.y, z: player.z};
          if (segmentBox(point, point, source, 0) === undefined) continue;
          emit(key + ':entry:' + player.id, {...context, kind: 'actorEnteredClearedFootprint',
            targetId: objective.id, playerId: player.id, position: {x: player.x, y: player.y, z: player.z},
            isCpu: Boolean(player.cpu), isAutopilot: Boolean(player.autopilot),
            ordinaryPlayerInput: !player.cpu && !player.autopilot, alive: player.alive});
        }
        for (const bullet of room.bullets) {
          const start = before.get(room.roomId)?.get(bullet.id);
          if (!start || segmentBox(start, bullet, source, 1) === undefined) continue;
          emit(key + ':projectile', {...context, kind: 'projectileCrossedClearedFootprint',
            targetId: objective.id, bulletId: bullet.id, ownerId: bullet.ownerId,
            start: {x: start.x, y: start.y, z: start.z}, end: {x: bullet.x, y: bullet.y, z: bullet.z},
            fraction: segmentBox(start, bullet, source, 1)});
        }
      }
      for (const event of result.events) {
        if (event.roomId !== room.roomId || !['objectiveHit', 'objectiveDestroyed', 'terrainHit'].includes(event.type)) continue;
        if (!event.targetId.startsWith('SCN:')) continue;
        emit(room.roomId + ':' + room.round + ':' + event.targetId + ':' + event.type,
          {...context, kind: 'ordinaryProjectileImpact', event});
      }
    }
    return result;
  };
}
