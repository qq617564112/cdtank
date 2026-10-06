/** Web qualified full resistance suppresses the shot's hurt action selector. */
export function resolveQualifiedShotHurtSelector(
  selector: number | undefined,
  qualifiedRate: number | undefined,
): number | undefined {
  return qualifiedRate !== undefined && qualifiedRate >= 1 ? undefined : selector;
}
