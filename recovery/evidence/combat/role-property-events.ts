export interface RolePropertyEventObserver<N, R, C> {
  attached(network: N, record: R, context: C): void;
  detached(network: N, record: R, context: C): void;
}

/** Original536b70/536dc0 forward to one optional observer (+0x24/+0x28). */
export function dispatchRolePropertyEvent<N, R, C>(
  observer: RolePropertyEventObserver<N, R, C> | undefined,
  event: 'attached' | 'detached',
  network: N,
  record: R,
  context: C,
): void {
  observer?.[event](network, record, context);
}
