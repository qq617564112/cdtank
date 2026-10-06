/** Current deployment directory; independent from chat channel numbers. */
export interface ReqChannel {operation: 'QUERY' | 'ENTER'; channelId?: string;}
export interface ResChannel {
  channels: Array<{id: string; name: string; region: string; levelLabel: string; available: boolean;}>;
  enteredChannelId?: string;
}
