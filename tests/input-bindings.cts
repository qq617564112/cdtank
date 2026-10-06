import assert from 'node:assert/strict';
import {
  DEFAULT_KEY_BINDINGS, INPUT_ACTIONS, isSupportedKeyCode, keyLabel,
  validateKeyBindings,
} from '../apps/web/src/match/input-bindings';

assert.deepEqual(INPUT_ACTIONS, [
  'forward', 'backward', 'turnLeft', 'turnRight', 'aimLeft', 'aimRight', 'fire',
  'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8',
]);
assert.deepEqual(DEFAULT_KEY_BINDINGS, {
  forward: 'KeyW', backward: 'KeyS', turnLeft: 'KeyA', turnRight: 'KeyD',
  aimLeft: 'ArrowLeft', aimRight: 'ArrowRight', fire: 'Space',
  slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3', slot4: 'Digit4',
  slot5: 'Digit5', slot6: 'Digit6', slot7: 'Digit7', slot8: 'Digit8',
});
assert.deepEqual(validateKeyBindings(DEFAULT_KEY_BINDINGS), DEFAULT_KEY_BINDINGS);

const custom = {
  forward: 'ArrowUp', backward: 'ArrowDown', turnLeft: 'KeyJ', turnRight: 'KeyL',
  aimLeft: 'Home', aimRight: 'End', fire: 'Numpad0',
  slot1: 'Numpad1', slot2: 'Numpad2', slot3: 'Numpad3', slot4: 'Numpad4',
  slot5: 'Numpad5', slot6: 'Numpad6', slot7: 'PageUp', slot8: 'PageDown',
};
assert.deepEqual(validateKeyBindings(custom), custom);
for (const action of INPUT_ACTIONS) {
  const missing: Record<string, unknown> = {...custom};
  delete missing[action];
  assert.equal(validateKeyBindings(missing), undefined, `missing ${action}`);
  assert.equal(validateKeyBindings({...custom, [action]: 'Escape'}), undefined);
  const duplicate = {...custom, [action]: custom[action === 'forward' ? 'backward' : 'forward']};
  assert.equal(validateKeyBindings(duplicate), undefined, `duplicate ${action}`);
}
for (const malformed of [null, undefined, [], INPUT_ACTIONS, 1, true, 'bindings', {}, () => custom]) {
  assert.equal(validateKeyBindings(malformed), undefined);
}
assert.equal(validateKeyBindings(Object.create(custom)), undefined);
const extra = JSON.parse(JSON.stringify({...custom, extra: 'Escape'}));
extra.__proto__ = {polluted: true};
assert.deepEqual(validateKeyBindings(extra), custom);
const parsedExtra = JSON.parse(`{"__proto__":{"polluted":true},${JSON.stringify(custom).slice(1)}`);
const safe = validateKeyBindings(parsedExtra);
assert.deepEqual(safe, custom);
assert.equal(Object.getPrototypeOf(safe), Object.prototype);
assert.equal(Object.hasOwn(safe!, '__proto__'), false);

const source = {...custom};
const copy = validateKeyBindings(source)!;
assert.notEqual(copy, source);
source.forward = 'KeyI';
assert.equal(copy.forward, 'ArrowUp');
copy.backward = 'KeyK';
assert.equal(source.backward, 'ArrowDown');
const defaultsCopy = validateKeyBindings(DEFAULT_KEY_BINDINGS)!;
defaultsCopy.forward = 'KeyI';
assert.equal(DEFAULT_KEY_BINDINGS.forward, 'KeyW');

for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  assert.equal(isSupportedKeyCode(`Key${letter}`), true);
  assert.equal(keyLabel(`Key${letter}`), letter);
}
for (let digit = 0; digit <= 9; digit++) {
  assert.equal(isSupportedKeyCode(`Digit${digit}`), true);
  assert.equal(isSupportedKeyCode(`Numpad${digit}`), true);
  assert.equal(keyLabel(`Digit${digit}`), String(digit));
  assert.equal(keyLabel(`Numpad${digit}`), `小键盘 ${digit}`);
}
for (const [code, label] of Object.entries({
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: '空格',
  Home: '首页', End: '末页', PageUp: '上页', PageDown: '下页',
})) {
  assert.equal(isSupportedKeyCode(code), true);
  assert.equal(keyLabel(code), label);
}
for (const code of [
  'Enter', 'NumpadEnter', 'Tab', 'Escape', 'ShiftLeft', 'ShiftRight', 'ControlLeft',
  'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'F1', 'F12',
  'Backspace', 'Delete', 'Insert', 'CapsLock', 'NumpadAdd', 'Keya', 'KeyAA',
  'Digit10', 'Numpad10', 'Arrow', ' KeyA', 'KeyA ', '', null, undefined, 1, {},
]) {
  assert.equal(isSupportedKeyCode(code), false);
  assert.equal(validateKeyBindings({...custom, forward: code}), undefined);
}
assert.equal(keyLabel('Enter'), 'Enter');
console.log('PASS: Web default/custom bindings, complete unique supported keys, safe copies and key labels');
