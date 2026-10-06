import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleCombatState, RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {setBattleHealth} from '../apps/server/src/battle/health';

interface Row {
  present: boolean; observer: boolean; before: number; maxHp: number; value: number;
  accepted: boolean; result: {hp: number; maxHp: number} | null;
  events: {kind: string; index?: number; state: {hp: number; maxHp: number}}[];
}
const oracle: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/role-health-native.json', 'utf8'));
let cases = 0;
for (const row of oracle.rows.filter(row => row.present)) {
  const base = createRoleCombatState();
  const record = {hp: row.before, maxHp: row.maxHp};
  const notifications: {index: number; hp: number; maxHp: number}[] = [];
  const combat = new RoleCombatState(base.record, index => {
    notifications.push({index, hp: combat.record!.numericFields!.get(0x54)!,
      maxHp: combat.record!.numericFields!.get(0x58)!});
  });
  const player = {hp: row.before, attributes: {record}, combat};
  setBattleHealth(player, row.value);
  assert.deepEqual(record, row.result);
  assert.equal(player.hp, row.result!.hp);
  assert.equal(combat.record!.numericFields!.get(0x54), player.hp);
  assert.equal(combat.record!.numericFields!.get(0x58), row.maxHp | 0);
  const raw = row.events.find(event => event.kind === 'notify')!;
  assert.deepEqual(notifications, [{index: 12, hp: raw.state.hp, maxHp: row.maxHp | 0}]);
  cases++;
}
assert(cases > 0);
console.log(`PASS: ${cases} original HP raw notification/clamp fixtures through battle authority, numeric and attribute records`);
