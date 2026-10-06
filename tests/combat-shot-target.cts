import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectShotTarget} from '../apps/server/src/battle/roles/shot-target';

interface Row {
  position: number[]; direction: number[]; targetPosition: number[];
  targetPresent: boolean; scenePresent: boolean; sceneDistance: number;
  events: Array<{kind: string; type?: number; point?: number[]}>;
}
const {rows}: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/combat-shot-target-native.json', 'utf8'));
const point = ([x, y, z]: number[]) => ({x, y, z});
for (const row of rows) {
  const selected = selectShotTarget(point(row.position), point(row.direction),
    row.targetPresent ? {id: 'P2', position: point(row.targetPosition)} : undefined,
    row.scenePresent ? {id: 'scene', distance: row.sceneDistance} : undefined);
  const wireType = row.events.find(event => event.kind === 'send')!.type;
  assert.equal(selected.kind, wireType === 0x3a9d ? 'PLAYER' : wireType === 0x3aa0 ? 'SCENE' : 'FREE');
  if (selected.kind !== 'PLAYER') {
    assert.deepEqual(selected.point, point(row.events.find(event => event.kind === 'aim')!.point!));
  } else assert(!row.events.some(event => event.kind === 'aim'));
}
console.log(`PASS: ${rows.length} original target selection and f32 endpoint vectors, including scene tie priority`);
