export interface MsgChat {
  /** Rebuilt room channel is 0, team channel is 1; original IDs are unknown. */
  channel: number;
  text: string;
}
