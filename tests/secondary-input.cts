import assert from 'node:assert/strict';
import {BattleInput} from '../apps/web/src/match/battle-input';
import {
  bindingCodes, cloneKeyBindings, DEFAULT_KEY_BINDINGS, INPUT_ACTIONS, validateKeyBindings,
} from '../apps/web/src/match/input-bindings';
import type {InputAction, KeyBindings} from '../apps/web/src/match/input-bindings';
import type {MsgPlayerInput} from '../apps/shared/protocols/MsgPlayerInput';

const bindings: KeyBindings = {...DEFAULT_KEY_BINDINGS, secondary: {
  forward: 'KeyI', backward: 'KeyK', turnLeft: 'KeyJ', turnRight: 'KeyL',
  aimLeft: 'Home', aimRight: 'End', fire: 'Numpad0',
  slot1: 'Numpad1', slot2: 'Numpad2', slot3: 'Numpad3', slot4: 'Numpad4',
  slot5: 'Numpad5', slot6: 'Numpad6', slot7: 'Numpad7', slot8: 'Numpad8',
}};
assert.equal(Object.hasOwn(DEFAULT_KEY_BINDINGS, 'secondary'), false);
assert.deepEqual(validateKeyBindings(DEFAULT_KEY_BINDINGS), DEFAULT_KEY_BINDINGS);
assert.deepEqual(validateKeyBindings({...DEFAULT_KEY_BINDINGS, secondary: {}}), DEFAULT_KEY_BINDINGS);
assert.deepEqual(validateKeyBindings({...DEFAULT_KEY_BINDINGS, secondary: {extra: 'Escape'}}), DEFAULT_KEY_BINDINGS);
assert.deepEqual(validateKeyBindings(bindings), bindings);
for (const malformed of [null, undefined, [], 1, false, 'KeyI']) {
  assert.equal(validateKeyBindings({...DEFAULT_KEY_BINDINGS, secondary: malformed}), undefined);
}
for (const action of INPUT_ACTIONS) {
  assert.deepEqual(bindingCodes(DEFAULT_KEY_BINDINGS, action), [DEFAULT_KEY_BINDINGS[action]]);
  assert.deepEqual(bindingCodes(bindings, action), [bindings[action], bindings.secondary![action]]);
  for (const code of [bindings[action], 'Escape', undefined]) {
    assert.equal(validateKeyBindings({...bindings, secondary: {...bindings.secondary, [action]: code}}), undefined);
  }
}
assert.equal(validateKeyBindings({...bindings, secondary: {...bindings.secondary, fire: bindings.forward}}), undefined);
assert.equal(validateKeyBindings({...bindings, secondary: {...bindings.secondary, fire: bindings.secondary!.forward}}), undefined);
for (const copy of [validateKeyBindings(bindings)!, cloneKeyBindings(bindings)]) {
  assert.notEqual(copy, bindings);
  assert.notEqual(copy.secondary, bindings.secondary);
  copy.secondary!.forward = 'KeyQ';
  assert.equal(bindings.secondary!.forward, 'KeyI');
}
assert.deepEqual(cloneKeyBindings(DEFAULT_KEY_BINDINGS), DEFAULT_KEY_BINDINGS);

// Node EventTarget fixtures exercise the production listeners without a browser.
class ElementFixture extends EventTarget {
  constructor(readonly tagName: string, readonly isContentEditable = false) {super();}
  closest(): ElementFixture | null {
    return ['input', 'select', 'button', 'textarea'].includes(this.tagName) ? this : null;
  }
  matches(): boolean {return this.closest() !== null || this.isContentEditable;}
}

const windowFixture = new EventTarget();
const intervals = new Map<number, () => void>();
let intervalId = 0;
const originals = new Map<string, PropertyDescriptor | undefined>();
function replaceGlobal(name: string, value: unknown): void {
  originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, {configurable: true, writable: true, value});
}
replaceGlobal('window', windowFixture);
replaceGlobal('HTMLElement', ElementFixture);
replaceGlobal('setInterval', (callback: () => void, delay: number) => {
  assert.equal(delay, 50);
  intervals.set(++intervalId, callback);
  return intervalId;
});
replaceGlobal('clearInterval', (id: number) => {intervals.delete(id);});

function keyboard(type: 'keydown' | 'keyup', code: string,
  options: Record<string, unknown> = {}): Event {
  const event = new Event(type, {cancelable: true});
  for (const [key, value] of Object.entries({
    code, repeat: false, isComposing: false, ctrlKey: false, altKey: false, metaKey: false,
    ...options,
  })) Object.defineProperty(event, key, {value});
  windowFixture.dispatchEvent(event);
  return event;
}

try {
  const context = {active: true, playing: true, connected: true, autopilot: false};
  const messages: MsgPlayerInput[] = [];
  const input = new BattleInput(() => context, message => {messages.push(message);});
  input.setKeyBindings(bindings);
  const returned = input.getKeyBindings();
  returned.secondary!.forward = 'KeyQ';
  assert.equal(input.getKeyBindings().secondary!.forward, 'KeyI');
  const supplied = cloneKeyBindings(bindings);
  input.setKeyBindings(supplied);
  supplied.secondary!.forward = 'KeyQ';
  assert.equal(input.getKeyBindings().secondary!.forward, 'KeyI');

  function state(move = 0, turn = 0, aim = 0, fire = false): void {
    const before = messages.length;
    input.send();
    assert.equal(messages.length, before + 1);
    const message = messages.at(-1)!;
    assert.deepEqual([message.move, message.turn, message.aim, message.fire], [move, turn, aim, fire]);
  }
  const movement: Array<[InputAction, number, number, number, boolean]> = [
    ['forward', 1, 0, 0, false], ['backward', -1, 0, 0, false],
    ['turnLeft', 0, 1, 0, false], ['turnRight', 0, -1, 0, false],
    ['aimLeft', 0, 0, 1, false], ['aimRight', 0, 0, -1, false],
    ['fire', 0, 0, 0, true],
  ];
  for (const [action, move, turn, aim, fire] of movement) {
    const [primary, secondary] = bindingCodes(bindings, action);
    for (const code of [primary, secondary]) {
      assert.equal(keyboard('keydown', code).defaultPrevented, true);
      keyboard('keydown', code, {repeat: true});
      state(move, turn, aim, fire);
      keyboard('keyup', code);
      state();
    }
    for (const [released, remaining] of [[primary, secondary], [secondary, primary]]) {
      keyboard('keydown', primary);
      keyboard('keydown', secondary);
      state(move, turn, aim, fire);
      keyboard('keyup', released);
      state(move, turn, aim, fire);
      keyboard('keyup', remaining);
      state();
    }
  }
  for (let slot = 1; slot <= 8; slot++) {
    for (const code of bindingCodes(bindings, `slot${slot}` as InputAction)) {
      const before = messages.length;
      assert.equal(keyboard('keydown', code).defaultPrevented, true);
      assert.equal(messages.length, before + 1);
      assert.equal(messages.at(-1)!.useItem, slot);
      keyboard('keydown', code, {repeat: true});
      assert.equal(messages.length, before + 1);
      keyboard('keyup', code);
      keyboard('keydown', code);
      assert.equal(messages.length, before + 2);
      keyboard('keyup', code);
    }
  }
  keyboard('keydown', 'KeyI');
  assert.throws(() => input.setKeyBindings({...bindings, secondary: {forward: 'Space'}}), /键位配置无效/);
  assert.deepEqual(input.getKeyBindings(), bindings);
  state(1);
  input.setKeyBindings(bindings);
  state();
  for (const clear of [() => input.clear(), () => windowFixture.dispatchEvent(new Event('blur'))]) {
    keyboard('keydown', 'KeyW');
    keyboard('keydown', 'KeyI');
    keyboard('keydown', 'Numpad0');
    clear();
    state();
  }
  for (const target of [new ElementFixture('input'), new ElementFixture('select'),
    new ElementFixture('button'), new ElementFixture('textarea'), new ElementFixture('div', true)]) {
    assert.equal(keyboard('keydown', 'KeyI', {target}).defaultPrevented, false);
    state();
    const before = messages.length;
    keyboard('keydown', 'Numpad1', {target});
    assert.equal(messages.length, before);
    keyboard('keydown', 'KeyW');
    keyboard('keydown', 'KeyI');
    const focus = new Event('focusin');
    Object.defineProperty(focus, 'target', {value: target});
    windowFixture.dispatchEvent(focus);
    state();
  }
  for (const flag of ['isComposing', 'ctrlKey', 'altKey', 'metaKey']) {
    const before = messages.length;
    assert.equal(keyboard('keydown', 'KeyI', {[flag]: true}).defaultPrevented, false);
    keyboard('keydown', 'Numpad1', {[flag]: true});
    assert.equal(messages.length, before);
    state();
  }
  for (const field of ['active', 'playing'] as const) {
    context[field] = false;
    const before = messages.length;
    assert.equal(keyboard('keydown', 'KeyI').defaultPrevented, false);
    keyboard('keydown', 'Numpad1');
    assert.equal(messages.length, before);
    context[field] = true;
    state();
  }
  for (const field of ['autopilot', 'connected'] as const) {
    context[field] = field === 'autopilot';
    const before = messages.length;
    keyboard('keydown', 'KeyI');
    keyboard('keydown', 'Numpad1');
    input.send();
    assert.equal(messages.length, before);
    input.clear();
    context[field] = field === 'connected';
    state();
  }
  input.setKeyBindings(DEFAULT_KEY_BINDINGS);
  assert.deepEqual(input.getKeyBindings(), DEFAULT_KEY_BINDINGS);
  assert.equal(keyboard('keydown', 'KeyI').defaultPrevented, false);
  state();
  console.log('PASS: secondary bindings validation, copies, all actions, held-key union, shortcuts and input gates');
} finally {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
