export const INPUT_ACTIONS = [
  'forward', 'backward', 'turnLeft', 'turnRight', 'aimLeft', 'aimRight', 'fire',
  'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8',
] as const;

export type InputAction = typeof INPUT_ACTIONS[number];
export type KeyBindings = Record<InputAction, string> & {
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
};

export function isSupportedKeyCode(value: unknown): value is string {
  return typeof value === 'string'
    && /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Left|Right|Up|Down)|Space|Home|End|PageUp|PageDown)$/.test(value);
}

export function validateKeyBindings(value: unknown): KeyBindings | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const bindings = {} as KeyBindings;
  const used = new Set<string>();
  for (const action of INPUT_ACTIONS) {
    if (!Object.hasOwn(source, action)) return undefined;
    const code = source[action];
    if (!isSupportedKeyCode(code) || used.has(code)) return undefined;
    bindings[action] = code;
    used.add(code);
  }
  if (Object.hasOwn(source, 'secondary')) {
    const value = source.secondary;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const sourceSecondary = value as Record<string, unknown>;
    const secondary: Partial<Record<InputAction, string>> = {};
    for (const action of INPUT_ACTIONS) {
      if (!Object.hasOwn(sourceSecondary, action)) continue;
      const code = sourceSecondary[action];
      if (!isSupportedKeyCode(code) || used.has(code)) return undefined;
      secondary[action] = code;
      used.add(code);
    }
    if (Object.keys(secondary).length) bindings.secondary = secondary;
  }
  return bindings;
}

export function bindingCodes(bindings: KeyBindings, action: InputAction): string[] {
  const secondary = bindings.secondary?.[action];
  return secondary === undefined ? [bindings[action]] : [bindings[action], secondary];
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
    default: return code;
  }
}
