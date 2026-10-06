/** Rebuilt session-owned readiness; original3aaf/3ab0 are separate requests.
 * All readiness votes begin loading; per-client loading acknowledgements begin play.
 */
export interface ReqReady {
  /** Current waiting/loading round observed by the client. */
  round: number;
  isReady?: boolean;
  /** Separate acknowledgement sent only after this client's battle resources are ready. */
  resourcesLoaded?: boolean;
}

export interface ResReady {
  round: number;
}
