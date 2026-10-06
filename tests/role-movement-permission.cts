import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleCombatState, RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {isRoleMovementAllowed, roleMovementCommand} from '../apps/server/src/battle/roles/movement-permission';
import {World} from '../apps/server/src/world';
import type {MsgPlayerInput} from '../apps/shared/protocols';

const native: {rows: {present: boolean; status: 0 | 1 | 2 | 3; flag8: boolean;
  flag9: boolean; flag10: boolean; command: number; allowed: boolean}[]} =
  JSON.parse(readFileSync('recovery/output/movement-permission-native.json', 'utf8'));
for (const row of native.rows) {
  const state = row.present ? createRoleCombatState() : new RoleCombatState(undefined);
  if (state.record) {
    state.record.status = row.status;
    state.record.flags[8] = row.flag8 ? 2 : 0;
    state.record.flags[9] = row.flag9 ? 255 : 0;
    state.record.flags[10] = row.flag10 ? 128 : 0;
  }
  assert.equal(isRoleMovementAllowed(state, row.command), row.allowed, JSON.stringify(row));
}
const inputs: {inputRows: {bits: number; commands: {command: number}[]}[]} =
  JSON.parse(readFileSync('recovery/output/movement-input-clock-native.json', 'utf8'));
for (const row of inputs.inputRows) {
  const move = row.bits & 1 ? 1 : row.bits & 2 ? -1 : 0;
  const turn = row.bits & 4 ? 1 : row.bits & 8 ? -1 : 0;
  assert.equal(roleMovementCommand(move, turn), row.commands[0]?.command ?? 0);
}

let now = 1000000;
const world = new World(() => now, {minPlayers: 2, timeLimitSeconds: 60});
const summary = world.listRooms().find(room => room.mode === 1)!;
const a = world.joinRoom(summary.id, 'A', 'A', 1);
const b = world.joinRoom(summary.id, 'B', 'B', 1);
world.ready(a.playerId, 1); world.ready(b.playerId, 1);
interface Actor {id: string; x: number; y: number; z: number; yaw: number;
  aim: number; combat: RoleCombatState;}
const room = (world as unknown as {rooms: Map<string, {players: Map<string, Actor>}>}).rooms.get(summary.id)!;
const actor = room.players.get(a.playerId)!;
let sequence = 0;
function step(move: number, turn: number, aim = 0, fire = false) {
  const input: MsgPlayerInput = {sequence: ++sequence, move, turn, aim, fire, useItem: 0, clientTime: 0};
  world.updateInput(actor.id, input);
  now += 50;
  return world.step(50);
}
const pose = () => [actor.x, actor.y, actor.z, actor.yaw];
actor.combat.setFlag(8, true);
const before = pose();
const beforeAim = actor.aim;
assert(step(1, 1, 1, true).events.some(event => event.type === 'fire' && event.playerId === actor.id));
assert.deepEqual(pose(), before, 'Original flag8 must prevent translation and body rotation');
assert(actor.aim > beforeAim, 'Independent aim remains active while movement is denied');
actor.combat.setFlag(8, false);
actor.combat.setFlag(9, false);
step(1, 0);
assert.deepEqual(pose(), before, 'Missing straight permit must prevent translation');
step(0, 1);
assert.notEqual(actor.yaw, before[3], 'Original turn permit works without straight permit');
const afterTurn = pose();
step(1, 1);
assert.deepEqual(pose(), afterTurn, 'Combined command requires both original permits');
actor.combat.setFlag(9, true);
actor.combat.setFlag(10, false);
step(0, 1);
assert.deepEqual(pose(), afterTurn, 'Missing turn permit must prevent body rotation');
step(1, 0);
assert.notDeepEqual(pose().slice(0, 3), afterTurn.slice(0, 3), 'Straight permit works without turn permit');
assert.equal(actor.yaw, afterTurn[3]);
actor.combat.setFlag(10, true);
const released = pose();
step(1, 1);
assert.notEqual(actor.yaw, released[3], 'Restoring both permits resumes the ordinary combined input');
console.log(`PASS: ${native.rows.length} original role movement permits and ${inputs.inputRows.length} command mappings; real World blocks/resumes translation/body turn and preserves independent aim/fire`);
