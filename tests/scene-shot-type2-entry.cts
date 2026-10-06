import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {getBattlefield} from '../apps/server/src/battlefield';
import {queryShotTarget} from '../apps/server/src/battle/shot-query';

// Read-only entrance planning uses source spawn and current production query geometry.
const field = getBattlefield(7);
const player = {...field.spawns[0], id: 'P1'};
const players = new Map([[player.id, {...player, alive: true}]]);
const rows = field.boxes.map(box => {
  const x = box.matrix[12];
  const z = box.matrix[14];
  const distance = Math.hypot(x - player.x, z - player.z);
  const yaw = Math.atan2(x - player.x, z - player.z);
  const look = {x: Math.sin(yaw), y: 0, z: Math.cos(yaw)};
  return {id: box.id, center: [x, box.matrix[13], z], distance, yaw,
    result: queryShotTarget(player, look, players, field, 28)};
}).filter(row => row.distance < 450 && row.result.kind === 'SCENE' && row.result.targetId === row.id)
  .sort((a, b) => a.distance - b.distance);
assert(rows.length > 0, 'Source spawn must have a first static-box query entrance');
writeFileSync('recovery/output/scene-shot-type2-entry.json', JSON.stringify({
  status: 'OFFLINE_STATIC_BOX_ENTRY_READY', mapId: 7, player,
  selected: rows[0],
  scope: 'Read-only source spawn and production query. No player movement, server result authorization or visible hit is proved.',
}, null, 2) + '\n');
console.log(JSON.stringify({status: 'OFFLINE_STATIC_BOX_ENTRY_READY', selected: rows[0]}));
