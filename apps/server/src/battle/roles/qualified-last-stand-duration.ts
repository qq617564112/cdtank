export function resolveQualifiedLastStandDuration(qualified: boolean,
  durationSeconds: number): number | undefined {
  return qualified ? durationSeconds * 1000 : undefined;
}
