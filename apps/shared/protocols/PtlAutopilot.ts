/** Rebuilt control of the caller's existing participant; never creates inventory. */
export interface ReqAutopilot {
  round: number;
  enabled: boolean;
}
export interface ResAutopilot {
  round: number;
  enabled: boolean;
}
