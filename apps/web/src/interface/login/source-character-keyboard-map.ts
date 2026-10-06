/**
 * keyboard.xml character mapping transcribed from the recovered source
 * (recovery/output/login-character-keyboard-source.json, `characters`).
 * `control` is the source window name inside the `anniudi` container; `upper`
 * is the differing Shift/Caps glyph and `lower` is the equal-state glyph.
 */
export interface SourceCharacterKey {
  control: string;
  lower: string;
  upper: string;
}

export const SOURCE_CHARACTER_KEYS: readonly SourceCharacterKey[] = [
  {control: 'tidal', lower: '`', upper: '~'},
  {control: '1', lower: '1', upper: '!'},
  {control: '2', lower: '2', upper: '@'},
  {control: '3', lower: '3', upper: '#'},
  {control: '4', lower: '4', upper: '$'},
  {control: '5', lower: '5', upper: '%'},
  {control: '6', lower: '6', upper: '^'},
  {control: '7', lower: '7', upper: '&'},
  {control: '8', lower: '8', upper: '*'},
  {control: '9', lower: '9', upper: '('},
  {control: '0', lower: '0', upper: ')'},
  {control: 'minus', lower: '-', upper: '_'},
  {control: 'equal', lower: '=', upper: '+'},
  {control: 'q', lower: 'q', upper: 'Q'},
  {control: 'w', lower: 'w', upper: 'W'},
  {control: 'e', lower: 'e', upper: 'E'},
  {control: 'r', lower: 'r', upper: 'R'},
  {control: 't', lower: 't', upper: 'T'},
  {control: 'y', lower: 'y', upper: 'Y'},
  {control: 'u', lower: 'u', upper: 'U'},
  {control: 'i', lower: 'i', upper: 'I'},
  {control: 'o', lower: 'o', upper: 'O'},
  {control: 'p', lower: 'p', upper: 'P'},
  {control: 'leftbracket', lower: '[', upper: '{'},
  {control: 'rightbracket', lower: ']', upper: '}'},
  {control: 'backslash', lower: '\\', upper: '|'},
  {control: 'a', lower: 'a', upper: 'A'},
  {control: 's', lower: 's', upper: 'S'},
  {control: 'd', lower: 'd', upper: 'D'},
  {control: 'f', lower: 'f', upper: 'F'},
  {control: 'g', lower: 'g', upper: 'G'},
  {control: 'h', lower: 'h', upper: 'H'},
  {control: 'j', lower: 'j', upper: 'J'},
  {control: 'k', lower: 'k', upper: 'K'},
  {control: 'l', lower: 'l', upper: 'L'},
  {control: 'semicolon', lower: ';', upper: ':'},
  {control: 'quot', lower: "'", upper: '"'},
  {control: 'z', lower: 'z', upper: 'Z'},
  {control: 'x', lower: 'x', upper: 'X'},
  {control: 'c', lower: 'c', upper: 'C'},
  {control: 'v', lower: 'v', upper: 'V'},
  {control: 'b', lower: 'b', upper: 'B'},
  {control: 'n', lower: 'n', upper: 'N'},
  {control: 'm', lower: 'm', upper: 'M'},
  {control: 'comma', lower: ',', upper: '<'},
  {control: 'end', lower: '.', upper: '>'},
  {control: 'slash', lower: '/', upper: '?'},
];

/** Source static decorations drawn with the character keys. */
export const SOURCE_CHARACTER_DECORATIONS = ['maogutou', 'jiaoyin', 'gougutou', 'gougou'] as const;
