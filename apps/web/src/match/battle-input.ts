import type {MsgPlayerInput} from '../../../shared/protocols/MsgPlayerInput';
import {bindingCodes, cloneKeyBindings, DEFAULT_KEY_BINDINGS, INPUT_ACTIONS, validateKeyBindings} from './input-bindings';
import type {InputAction, KeyBindings} from './input-bindings';

export interface BattleInputContext {
  active: boolean;
  playing: boolean;
  connected: boolean;
  autopilot: boolean;
}

/** Manual controls send key changes immediately and refresh held input every 50 ms. */
export class BattleInput {
  private readonly keys = new Set<string>();
  private sequence = 0;
  private timer?: ReturnType<typeof setInterval>;
  private bindings: KeyBindings = {...DEFAULT_KEY_BINDINGS};

  constructor(private readonly readContext: () => BattleInputContext,
    private readonly sendMessage: (message: MsgPlayerInput) => void) {
    window.addEventListener('keydown', event => {
      const context = this.readContext();
      if (!context.active || !context.playing
          || event.isComposing || event.ctrlKey || event.altKey || event.metaKey
          || (event.target instanceof HTMLElement &&
            (event.target.closest('input, select, button, textarea') || event.target.isContentEditable))) {
        return;
      }
      const shortcut = Array.from({length: 8}, (_, index) => index + 1)
        .find(slot => bindingCodes(this.bindings, `slot${slot}` as InputAction).includes(event.code));
      if (shortcut !== undefined) {
        event.preventDefault();
        if (!event.repeat) this.send(shortcut);
        return;
      }
      if (INPUT_ACTIONS.some(action => bindingCodes(this.bindings, action).includes(event.code))) {
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
    window.addEventListener('focusin', event => {
      if (event.target instanceof HTMLElement && event.target.matches('input, select, button, textarea, [contenteditable]')) {
        this.clear();
      }
    });
  }

  clear(): void {
    if (!this.keys.size) return;
    this.keys.clear();
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
      if (context.connected && context.active && context.playing) this.send();
    }, 50);
  }

  stop(): void {clearInterval(this.timer); this.timer = undefined;}

  private held(action: InputAction): boolean {
    return bindingCodes(this.bindings, action).some(code => this.keys.has(code));
  }

  get motionAxes(): Pick<MsgPlayerInput, 'move' | 'turn' | 'aim'> {
    const context = this.readContext();
    if (!context.connected || !context.active || !context.playing || context.autopilot) {
      return {move: 0, turn: 0, aim: 0};
    }
    return {move: Number(this.held('forward')) - Number(this.held('backward')),
      turn: Number(this.held('turnLeft')) - Number(this.held('turnRight')),
      aim: Number(this.held('aimLeft')) - Number(this.held('aimRight'))};
  }

  send(useItem = 0): void {
    const context = this.readContext();
    if (!context.connected || !context.active || !context.playing || context.autopilot) return;
    this.sendMessage({
      sequence: ++this.sequence,
      ...this.motionAxes,
      fire: this.held('fire'), useItem, clientTime: Date.now(),
    });
  }
}
