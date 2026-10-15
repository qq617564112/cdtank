import type {MsgPlayerInput} from '../../../shared/protocols/MsgPlayerInput';
import {bindingCodes, cloneKeyBindings, DEFAULT_KEY_BINDINGS, validateKeyBindings} from './input-bindings';
import type {InputAction, KeyBindings} from './input-bindings';

export interface BattleInputContext {
  active: boolean;
  playing: boolean;
  connected: boolean;
  autopilot: boolean;
}

export interface BattleJoystickDirection {x: number; y: number;}
export type BattleTouchInput = Pick<MsgPlayerInput, 'move' | 'turn' | 'aim' | 'fire'> & {
  direction?: BattleJoystickDirection;
  movementGesture?: number;
};
export type BattleMotionInput = Pick<MsgPlayerInput, 'move' | 'turn' | 'aim'> & {
  direction?: BattleJoystickDirection;
  movementGesture?: number;
};
const NEUTRAL_TOUCH: BattleTouchInput = {move: 0, turn: 0, aim: 0, fire: false};
const SHORTCUT_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** Single-press shortcut actions that are not held like motion or fire. */
const PRESS_ACTIONS = ['useItem', 'prevWeapon', 'nextWeapon', 'prevItem', 'nextItem'] as const;

/** Movement and fire keys are tracked as held input; shortcuts act on keydown only. */
const HELD_ACTIONS = ['forward', 'backward', 'turnLeft', 'turnRight', 'aimLeft', 'aimRight', 'fire'] as const;

interface BattleInputShortcuts {
  /** Quantity gate for a slot request before it is sent. Returns false to drop
   * the request; accepted slots also move the local item cursor/discard choice. */
  acceptSlot(slot: number): boolean;
  /** Reflect a direct Battle slot1–8 press: item slots move the local cursor,
   * weapon slots drop any cycling intent. */
  itemSlot(slot: number): void;
  /** Selected local item slot for the ordinary useItem key, if any. */
  currentItemSlot(): number | undefined;
  /** Weapon cycle returns the ammo slot to select, or undefined when none. */
  cycleWeapon(direction: 1 | -1): number | undefined;
  /** Item cycle returns the Battle slot5–8 to use, or undefined when none. */
  cycleItem(direction: 1 | -1): number | undefined;
  /** Drop transient shortcut intent for blur, config reload, stop and lifecycle. */
  clearIntent(): void;
}

const NO_SHORTCUTS: BattleInputShortcuts = {
  acceptSlot: () => true, itemSlot: () => {}, currentItemSlot: () => undefined,
  cycleWeapon: () => undefined, cycleItem: () => undefined, clearIntent: () => {},
};

/** Manual controls send key changes immediately and refresh held input every 50 ms. */
export class BattleInput {
  private readonly keys = new Set<string>();
  private touch: BattleTouchInput = {...NEUTRAL_TOUCH};
  private sequence = 0;
  private timer?: ReturnType<typeof setInterval>;
  private bindings: KeyBindings = {...DEFAULT_KEY_BINDINGS};
  private readonly sendAxes: BattleMotionInput = {move: 0, turn: 0, aim: 0};

  constructor(private readonly readContext: () => BattleInputContext,
    private readonly sendMessage: (message: MsgPlayerInput) => void,
    private readonly shortcuts: BattleInputShortcuts = NO_SHORTCUTS) {
    window.addEventListener('keydown', event => {
      const context = this.readContext();
      if (!context.active || !context.playing || !context.connected || context.autopilot
          || event.isComposing
          || (event.ctrlKey && event.code !== 'ControlLeft' && event.code !== 'ControlRight')
          || event.altKey || event.metaKey
          || (event.target instanceof HTMLElement &&
            (event.target.closest('input, select, button, textarea') || event.target.isContentEditable))) {
        return;
      }
      const shortcut = SHORTCUT_SLOTS.find(slot => bindingCodes(this.bindings, `slot${slot}` as InputAction).includes(event.code));
      if (shortcut !== undefined) {
        event.preventDefault();
        if (!event.repeat) {
          this.shortcuts.itemSlot(shortcut);
          this.send(shortcut);
        }
        return;
      }
      // The five new shortcut actions refuse Shift combinations. This gate is
      // scoped to them so the original fifteen keys keep their existing held,
      // motion and number semantics, including Shift-assisted combos.
      const press = event.shiftKey ? undefined
        : PRESS_ACTIONS.find(action => bindingCodes(this.bindings, action).includes(event.code));
      if (press !== undefined) {
        event.preventDefault();
        if (event.repeat) return;
        if (press === 'useItem') {
          const slot = this.shortcuts.currentItemSlot();
          if (slot !== undefined) this.send(slot);
        } else if (press === 'prevWeapon') {
          const slot = this.shortcuts.cycleWeapon(-1);
          if (slot !== undefined) this.send(slot);
        } else if (press === 'nextWeapon') {
          const slot = this.shortcuts.cycleWeapon(1);
          if (slot !== undefined) this.send(slot);
        } else if (press === 'prevItem') {
          const slot = this.shortcuts.cycleItem(-1);
          if (slot !== undefined) this.send(slot);
        } else {
          const slot = this.shortcuts.cycleItem(1);
          if (slot !== undefined) this.send(slot);
        }
        return;
      }
      if (HELD_ACTIONS.some(action => bindingCodes(this.bindings, action).includes(event.code))) {
        event.preventDefault();
        if (!this.keys.has(event.code)) {
          this.keys.add(event.code);
          this.send();
        }
      }
    });
    window.addEventListener('keyup', event => {
      if (this.keys.delete(event.code)) this.send();
    });
    window.addEventListener('blur', () => {this.clear();});
    document.addEventListener('visibilitychange', () => {if (document.hidden) this.clear();});
    window.addEventListener('focusin', event => {
      if (event.target instanceof HTMLElement
          && event.target.matches('input, select, button, textarea, [contenteditable]')) {
        this.clear();
      }
    });
  }

  clear(): void {
    this.shortcuts.clearIntent();
    const hadInput = this.keys.size > 0 || Object.values(this.touch).some(Boolean);
    this.keys.clear();
    this.touch = {...NEUTRAL_TOUCH};
    if (hadInput) this.send();
  }

  setTouch(patch: Partial<BattleTouchInput>): void {
    const context = this.readContext();
    if (!context.connected || !context.active || !context.playing || context.autopilot) {
      this.touch = {...NEUTRAL_TOUCH};
      return;
    }
    if (Object.entries(patch).every(([key, value]) => this.touch[key as keyof BattleTouchInput] === value)) return;
    this.touch = {...this.touch, ...patch};
    this.send();
  }

  clearTouch(): void {
    if (!Object.values(this.touch).some(Boolean)) return;
    this.touch = {...NEUTRAL_TOUCH};
    this.send();
  }
  getKeyBindings(): KeyBindings {return cloneKeyBindings(this.bindings);}
  setKeyBindings(bindings: KeyBindings): void {
    const validated = validateKeyBindings(bindings);
    if (!validated) throw new Error('键位配置无效或存在冲突');
    this.clear();
    this.bindings = validated;
  }
  resetSequence(sequence = 0): void {this.sequence = sequence;}

  start(): void {
    this.stop();
    this.timer = setInterval(() => {
      const context = this.readContext();
      if (context.connected && context.active && context.playing && !context.autopilot) this.send();
      else this.clearTouch();
    }, 50);
  }

  stop(): void {clearInterval(this.timer); this.timer = undefined; this.clear();}

  private held(action: InputAction): boolean {
    const primary = this.bindings[action];
    if (primary !== undefined && this.keys.has(primary)) return true;
    const secondary = this.bindings.secondary?.[action];
    return secondary !== undefined && this.keys.has(secondary);
  }

  get motionAxes(): BattleMotionInput {
    return this.motionAxesToRef({move: 0, turn: 0, aim: 0});
  }

  /** The caller owns this synchronous motion workspace; no input record escapes. */
  motionAxesToRef(result: BattleMotionInput): BattleMotionInput {
    const context = this.readContext();
    if (!context.connected || !context.active || !context.playing || context.autopilot) {
      result.move = result.turn = result.aim = 0;
      delete result.direction;
      delete result.movementGesture;
      return result;
    }
    result.move = Math.max(-1, Math.min(1, this.touch.move + Number(this.held('forward')) - Number(this.held('backward'))));
    result.turn = Math.max(-1, Math.min(1, this.touch.turn + Number(this.held('turnLeft')) - Number(this.held('turnRight'))));
    result.aim = Math.max(-1, Math.min(1, this.touch.aim + Number(this.held('aimLeft')) - Number(this.held('aimRight'))));
    result.direction = this.touch.direction;
    result.movementGesture = this.touch.movementGesture;
    return result;
  }

  send(useItem = 0): void {
    const context = this.readContext();
    if (!context.connected || !context.active || !context.playing || context.autopilot) return;
    if (useItem > 0 && !this.shortcuts.acceptSlot(useItem)) return;
    const axes = this.motionAxesToRef(this.sendAxes);
    this.sendMessage({
      sequence: ++this.sequence,
      move: axes.move, turn: axes.turn, aim: axes.aim,
      fire: this.touch.fire || this.held('fire'), useItem, clientTime: Date.now(),
    });
  }
}
