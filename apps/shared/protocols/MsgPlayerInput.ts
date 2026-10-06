export interface MsgPlayerInput {
  sequence: number;
  move: number;
  turn: number;
  aim: number;
  fire: boolean;
  /** One shortcut press, slots1–8; zero means no shortcut request. */
  useItem: number;
  clientTime: number;
}
