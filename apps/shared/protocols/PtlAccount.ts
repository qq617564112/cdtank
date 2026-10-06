/** Rebuilt account sessions; tokens restore retained active room membership after transport loss. */
export interface ReqAccount {
  token?: string;
  credentials?: {operation: 'LOGIN' | 'REGISTER'; account: string; password: string;};
}
export interface ResAccount {accountId: string; token: string; accountName?: string;}
