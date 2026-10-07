export interface ReqFamily {}

export interface ResFamily {
  accountId: string;
  family?: {
    id: string;
    name: string;
  };
}
