/** Rebuilt authenticated lobby channel; original server/channel remains unrecovered. */
export interface MsgLobbyChat {
  /** Process-local accepted-message sequence. */
  id: number;
  accountId: string;
  text: string;
  /** Authoritative rebuilt account alias and trimmed text. */
  message: string;
}
