export const INPUT_ACTIONS = [
  'forward', 'backward', 'turnLeft', 'turnRight', 'aimLeft', 'aimRight', 'fire',
  'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8',
  'useItem', 'prevWeapon', 'nextWeapon', 'prevItem', 'nextItem',
] as const;

export type InputAction = typeof INPUT_ACTIONS[number];

/** Shortcuts whose primary may be absent in an existing saved configuration. */
export const OPTIONAL_INPUT_ACTIONS = [
  'useItem', 'prevWeapon', 'nextWeapon', 'prevItem', 'nextItem',
] as const satisfies readonly InputAction[];

export type OptionalInputAction = typeof OPTIONAL_INPUT_ACTIONS[number];
export type RequiredInputAction = Exclude<InputAction, OptionalInputAction>;

const OPTIONAL_INPUT_SET: ReadonlySet<InputAction> = new Set(OPTIONAL_INPUT_ACTIONS);

export type KeyBindings = Record<RequiredInputAction, string>
  & Partial<Record<OptionalInputAction, string>>
  & {
  secondary?: Partial<Record<InputAction, string>>;
};

/** Defaults used by the Web reconstruction. */
export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  forward: 'KeyW',
  backward: 'KeyS',
  turnLeft: 'KeyA',
  turnRight: 'KeyD',
  aimLeft: 'ArrowLeft',
  aimRight: 'ArrowRight',
  fire: 'Space',
  slot1: 'Digit1',
  slot2: 'Digit2',
  slot3: 'Digit3',
  slot4: 'Digit4',
  slot5: 'Digit5',
  slot6: 'Digit6',
  slot7: 'Digit7',
  slot8: 'Digit8',
  useItem: 'ControlLeft',
  prevWeapon: 'Home',
  nextWeapon: 'End',
  prevItem: 'PageUp',
  nextItem: 'PageDown',
};

export function isSupportedKeyCode(value: unknown): value is string {
  return typeof value === 'string'
    && /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Left|Right|Up|Down)|Space|Home|End|PageUp|PageDown|ControlLeft|ControlRight)$/.test(value);
}

export function validateKeyBindings(value: unknown): KeyBindings | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const bindings: Record<string, unknown> = {};
  const used = new Set<string>();
  for (const action of INPUT_ACTIONS) {
    if (!Object.hasOwn(source, action)) {
      if (OPTIONAL_INPUT_SET.has(action)) continue;
      return undefined;
    }
    const code = source[action];
    if (!isSupportedKeyCode(code) || used.has(code)) return undefined;
    bindings[action] = code;
    used.add(code);
  }
  if (Object.hasOwn(source, 'secondary')) {
    const value = source.secondary;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const sourceSecondary = value as Record<string, unknown>;
    const secondary: Record<string, string> = {};
    for (const action of INPUT_ACTIONS) {
      if (!Object.hasOwn(sourceSecondary, action)) continue;
      const code = sourceSecondary[action];
      if (!isSupportedKeyCode(code) || used.has(code)) return undefined;
      secondary[action] = code;
      used.add(code);
    }
    if (Object.keys(secondary).length) bindings.secondary = secondary;
  }
  return bindings as unknown as KeyBindings;
}

export function bindingCodes(bindings: KeyBindings, action: InputAction): string[] {
  const codes: string[] = [];
  const primary = bindings[action];
  if (primary !== undefined) codes.push(primary);
  const secondary = bindings.secondary?.[action];
  if (secondary !== undefined) codes.push(secondary);
  return codes;
}

export function cloneKeyBindings(bindings: KeyBindings): KeyBindings {
  return bindings.secondary
    ? {...bindings, secondary: {...bindings.secondary}}
    : {...bindings};
}

export function keyLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `小键盘 ${code.slice(6)}`;
  switch (code) {
    case 'Space': return '空格';
    case 'ArrowLeft': return '←';
    case 'ArrowRight': return '→';
    case 'ArrowUp': return '↑';
    case 'ArrowDown': return '↓';
    case 'Home': return '首页';
    case 'End': return '末页';
    case 'PageUp': return '上页';
    case 'PageDown': return '下页';
    case 'ControlLeft': return '左Ctrl';
    case 'ControlRight': return '右Ctrl';
    default: return code;
  }
}
