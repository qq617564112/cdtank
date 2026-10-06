/** Original427ba2/427bf9: preview uses owned instances; battle uses stored objects. */
export function resolveRoleRecomputeSource<T>(
  stage: number,
  direct: T | undefined,
  previewInstanceId: number,
  lookup: (instanceId: number) => T | undefined,
): T | undefined {
  if (stage === 2) return lookup(previewInstanceId >>> 0);
  if (stage === 3 || stage === 4) return direct;
  return undefined;
}
