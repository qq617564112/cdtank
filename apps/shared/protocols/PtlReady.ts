/** Rebuilt session-owned readiness; original3aaf/3ab0 are separate requests.
 * Starting when everyone is ready remains a rebuilt server policy.
 */
export interface ReqReady {
  /** Round observed by the client after battlefield resources have loaded. */
  round: number;
  isReady?: boolean;
}

export interface ResReady {
  round: number;
}
