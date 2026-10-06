import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BattleInfoOpacity} from '../apps/web/src/interface/battle/battle-info-opacity';

const native = JSON.parse(readFileSync('recovery/output/battle-info-alpha-native.json', 'utf8')) as {
  status: string;
  frameRows: {initial: number; delta: number; alpha: number}[];
  hoverRows: {event: string; elapsed: number; alpha: number}[];
};
assert.equal(native.status, 'PASS');
for (const row of native.frameRows) {
  const state = new BattleInfoOpacity();
  state.advance(row.initial);
  state.hover(true);
  state.advance(row.delta);
  assert.equal(state.getSnapshot(), row.alpha, JSON.stringify(row));
}
for (const row of native.hoverRows) {
  const state = new BattleInfoOpacity();
  state.advance(row.elapsed);
  state.hover(true);
  state.hover(row.event === 'enter');
  assert.equal(state.getSnapshot(), row.alpha, JSON.stringify(row));
}
const state = new BattleInfoOpacity();
let notifications = 0;
const unsubscribe = state.subscribe(() => notifications++);
state.advance(7.9); state.hover(true); state.advance(.2);
assert.equal(state.getSnapshot(), Math.fround(.2), 'hover does not lock opacity before threshold');
state.hover(true); state.advance(1);
assert.equal(state.getSnapshot(), 1, 'late hover survives subsequent frames');
state.hover(false); state.reset(); state.advance(1);
assert.equal(state.getSnapshot(), 1, 'new message restarts clock');
assert.equal(notifications, 4, 'only changed scalar values notify');
unsubscribe(); state.advance(8);
assert.equal(notifications, 4);
console.log(`PASS ${native.frameRows.length} native clock and ${native.hoverRows.length} hover vectors, ordering, reset and isolated notifications`);
