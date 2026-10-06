/** Manual tank motion belongs to this client for the identified round and life. */
export interface ClientTankPose {
  round: number;
  life: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  bodyYaw: number;
  aim: number;
  command: number;
}

export interface MsgPlayerInput {
  sequence: number;
  move: number;
  turn: number;
  aim: number;
  fire: boolean;
  /** One shortcut press, slots1–8; zero means no shortcut request. */
  useItem: number;
  clientTime: number;
  pose?: ClientTankPose;
}
