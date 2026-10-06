/** Rebuilt current lobby membership, separate from friends or room rosters. */
export interface ReqLobbyPlayers {}

export interface ResLobbyPlayers {
  players: {accountId: string; name: string}[];
}
