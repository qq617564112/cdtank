import assert from 'node:assert/strict';
import {BattleInput} from '../apps/web/src/match/battle-input';
import {DEFAULT_KEY_BINDINGS} from '../apps/web/src/match/input-bindings';
import type {KeyBindings} from '../apps/web/src/match/input-bindings';
import type {MsgPlayerInput} from '../apps/shared/protocols/MsgPlayerInput';

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
  function sendState(move: number, turn: number, aim: number, fire: boolean, useItem = 0): void {
    const before = messages.length;
    input.send(useItem);
    assert.equal(messages.length, before + 1);
    const message = messages.at(-1)!;
    assert.deepEqual({move: message.move, turn: message.turn, aim: message.aim,
      fire: message.fire, useItem: message.useItem}, {move, turn, aim, fire, useItem});
    assert.equal(typeof message.clientTime, 'number');
  }

  assert.deepEqual(input.getKeyBindings(), DEFAULT_KEY_BINDINGS);
  for (const [code, move, turn, aim, fire] of [
    ['KeyW', 1, 0, 0, false], ['KeyS', -1, 0, 0, false],
    ['KeyA', 0, 1, 0, false], ['KeyD', 0, -1, 0, false],
    ['ArrowLeft', 0, 0, 1, false], ['ArrowRight', 0, 0, -1, false],
    ['Space', 0, 0, 0, true],
  ] as const) {
    assert.equal(keyboard('keydown', code).defaultPrevented, true);
    sendState(move, turn, aim, fire);
    keyboard('keyup', code);
    sendState(0, 0, 0, false);
  }
  for (let slot = 1; slot <= 8; slot++) {
    const before = messages.length;
    assert.equal(keyboard('keydown', `Digit${slot}`).defaultPrevented, true);
    assert.equal(messages.length, before + 1);
    assert.equal(messages.at(-1)!.useItem, slot);
    keyboard('keydown', `Digit${slot}`, {repeat: true});
    assert.equal(messages.length, before + 1);
  }
  for (const flag of ['isComposing', 'ctrlKey', 'altKey', 'metaKey']) {
    const before = messages.length;
    assert.equal(keyboard('keydown', 'KeyW', {[flag]: true}).defaultPrevented, false);
    assert.equal(keyboard('keydown', 'Digit1', {[flag]: true}).defaultPrevented, false);
    assert.equal(messages.length, before);
    sendState(0, 0, 0, false);
  }
  for (const field of ['active', 'playing'] as const) {
    context[field] = false;
    const before = messages.length;
    assert.equal(keyboard('keydown', 'KeyW').defaultPrevented, false);
    keyboard('keydown', 'Digit1');
    assert.equal(messages.length, before);
    context[field] = true;
    sendState(0, 0, 0, false);
  }
  for (const target of [new ElementFixture('input'), new ElementFixture('select'),
    new ElementFixture('button'), new ElementFixture('textarea'), new ElementFixture('div', true)]) {
    assert.equal(keyboard('keydown', 'KeyW', {target}).defaultPrevented, false);
    sendState(0, 0, 0, false);
    keyboard('keydown', 'KeyW');
    const focus = new Event('focusin');
    Object.defineProperty(focus, 'target', {value: target});
    windowFixture.dispatchEvent(focus);
    sendState(0, 0, 0, false);
  }
  keyboard('keydown', 'KeyW');
  keyboard('keydown', 'Space');
  windowFixture.dispatchEvent(new Event('blur'));
  sendState(0, 0, 0, false);

  const custom: KeyBindings = {
    forward: 'KeyI', backward: 'KeyK', turnLeft: 'KeyJ', turnRight: 'KeyL',
    aimLeft: 'Home', aimRight: 'End', fire: 'Numpad0',
    slot1: 'Numpad1', slot2: 'Numpad2', slot3: 'Numpad3', slot4: 'Numpad4',
    slot5: 'Numpad5', slot6: 'Numpad6', slot7: 'Numpad7', slot8: 'Numpad8',
  };
  keyboard('keydown', 'KeyW');
  input.setKeyBindings(custom);
  sendState(0, 0, 0, false);
  assert.equal(keyboard('keydown', 'KeyW').defaultPrevented, false);
  for (const [code, move, turn, aim, fire] of [
    ['KeyI', 1, 0, 0, false], ['KeyK', -1, 0, 0, false],
    ['KeyJ', 0, 1, 0, false], ['KeyL', 0, -1, 0, false],
    ['Home', 0, 0, 1, false], ['End', 0, 0, -1, false],
    ['Numpad0', 0, 0, 0, true],
  ] as const) {
    keyboard('keydown', code);
    sendState(move, turn, aim, fire);
    keyboard('keyup', code);
  }
  for (let slot = 1; slot <= 8; slot++) {
    const before = messages.length;
    keyboard('keydown', `Digit${slot}`);
    assert.equal(messages.length, before);
    keyboard('keydown', `Numpad${slot}`);
    assert.equal(messages.length, before + 1);
    assert.equal(messages.at(-1)!.useItem, slot);
    keyboard('keydown', `Numpad${slot}`, {repeat: true});
    assert.equal(messages.length, before + 1);
  }
  keyboard('keydown', 'KeyI');
  assert.throws(() => input.setKeyBindings({...custom, fire: custom.forward}), /键位配置无效/);
  assert.throws(() => input.setKeyBindings({...custom, fire: 'Escape'}), /键位配置无效/);
  assert.deepEqual(input.getKeyBindings(), custom);
  sendState(1, 0, 0, false);
  input.setKeyBindings({...custom, forward: 'KeyW'});
  sendState(0, 0, 0, false);
  keyboard('keydown', 'KeyI');
  sendState(0, 0, 0, false);
  input.setKeyBindings(custom);
  custom.forward = 'KeyQ';
  const returned = input.getKeyBindings();
  returned.forward = 'KeyR';
  assert.equal(input.getKeyBindings().forward, 'KeyI');

  context.autopilot = true;
  let before = messages.length;
  keyboard('keydown', 'Numpad1');
  keyboard('keydown', 'KeyI');
  input.send();
  assert.equal(messages.length, before);
  input.clear();
  context.autopilot = false;
  context.connected = false;
  before = messages.length;
  input.send();
  keyboard('keydown', 'Numpad1');
  assert.equal(messages.length, before);
  context.connected = true;

  input.resetSequence();
  input.start();
  assert.equal(intervals.size, 1);
  const tick = [...intervals.values()][0];
  before = messages.length;
  tick();
  assert.equal(messages.length, before + 1);
  assert.equal(messages.at(-1)!.sequence, 1);
  for (const field of ['active', 'playing', 'connected'] as const) {
    context[field] = false;
    before = messages.length;
    tick();
    assert.equal(messages.length, before);
    context[field] = true;
  }
  context.autopilot = true;
  before = messages.length;
  tick();
  assert.equal(messages.length, before);
  context.autopilot = false;
  tick();
  assert.equal(messages.at(-1)!.sequence, 2);
  input.stop();
  assert.equal(intervals.size, 0);
  input.start();
  assert.equal(intervals.size, 1);
  input.stop();
  assert.equal(intervals.size, 0);
  console.log('PASS: production BattleInput bindings, shortcuts, input gates, clearing and 50 ms lifecycle (Node fixtures)');
} finally {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
