export interface ReqSelectRole {
  kind: 'pet' | 'tank';
  instanceId: number;
}
export interface ResSelectRole {
  /** Original page update code0 pet / code1 tank, with confirmed selected profile. */
  code: 0 | 1;
  profile: {bytes: number[]; strings: [string, string]};
}
