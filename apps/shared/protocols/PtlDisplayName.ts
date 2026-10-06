/** Independent rebuilt nickname, separate from original role profile strings. */
export interface ReqDisplayName {
  /** Omitted to query the current name. */
  name?: string;
}

export interface ResDisplayName {
  name: string;
}
