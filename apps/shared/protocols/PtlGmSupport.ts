export interface GmSupportReply {
  id: number;
  requestId: number;
  question: string;
  requestedAt: number;
  text: string;
  repliedAt: number;
}

export interface ReqGmSupport {afterId?: number;}

export interface ResGmSupport {
  accountId: string;
  replies: GmSupportReply[];
  nextAfterId: number;
  hasMore: boolean;
}
