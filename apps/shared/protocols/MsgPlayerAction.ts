export const GroundItemAction = {
  DISCARD: 100,
} as const;

export interface MsgPlayerAction {
  roomId: string;
  round: number;
  sequence: number;
  action: number;
  value: number;
  clientTime: number;
}
