/** Original timeline calculations, from 0x47f0eb, 0x47f572 and 0x47eef0. */
export interface EffectControllerBoundary {
  start: number;
  end: number;
  flag: number;
}

export interface EffectTimelineConfig {
  delay: number;
  lifetime: number;
  controllers: readonly EffectControllerBoundary[];
}

export interface EffectControllerSelection {
  index: number;
  resetIndices: number[];
}

export function effectHasStarted(elapsed: number, delay: number): boolean {
  return Math.fround(elapsed) >= Math.fround(delay);
}

/** The native lifetime condition; derived effects may impose extra conditions. */
export function effectLifetimeEnded(elapsed: number, delay: number, lifetime: number): boolean {
  return Math.fround(lifetime) > 0 &&
      Math.fround(delay) + Math.fround(lifetime) <= Math.fround(elapsed);
}

export function selectEffectController(
  elapsed: number,
  config: EffectTimelineConfig,
  previousIndex: number,
): EffectControllerSelection {
  const result: EffectControllerSelection = {index: previousIndex, resetIndices: []};
  selectEffectControllerToRef(elapsed, config, previousIndex, result);
  return result;
}

/** Writes the selection into caller-owned storage, including its reset list. */
export function selectEffectControllerToRef(
  elapsed: number,
  config: EffectTimelineConfig,
  previousIndex: number,
  result: EffectControllerSelection,
): void {
  const resetIndices = result.resetIndices;
  resetIndices.length = 0;
  result.index = previousIndex;
  const controllers = config.controllers;
  if (controllers.length === 0) {
    return;
  }
  if (!Number.isInteger(previousIndex) || previousIndex < -1 ||
      previousIndex >= controllers.length) {
    throw new Error('Invalid original effect controller index');
  }
  // Original stores the local f32 time, but first-start comparison uses x87 sum.
  const local = Math.fround(elapsed) - Math.fround(config.delay);
  let index = local < Math.fround(controllers[0].start) ? -1 : previousIndex;
  let end = index < 0 ? controllers[0].start : controllers[index].end;
  const localStored = Math.fround(local);
  // Bounds are absolute local times. Equality retains the current controller.
  while (end > 0 && localStored > Math.fround(end)) {
    ++index;
    if (index >= controllers.length) {
      index = controllers.length - 1;
      break;
    }
    if (index > 0) {
      resetIndices.push(index);
    }
    end = controllers[index].end;
  }
  result.index = index;
}
