/** Summarize actual source327 state transitions without filling missing draws. */
export function summarizeMap02PlantRoundReset(observed) {
  var roots = observed?.roots ?? [];
  var draws = observed?.draws ?? [];
  var transitions = [];
  for (var hidden of roots) {
    if (hidden.sourcePlacementId !== '327' || !hidden.hidden || hidden.rootEnabled ||
        !hidden.sourceEnabled || hidden.owners !== 29) continue;
    var restored = roots.find(function(value) {
      return value.sourcePlacementId === '327' && value.rootRevision === hidden.rootRevision &&
        value.round === hidden.round + 1 && !value.hidden && value.rootEnabled &&
        value.sourceEnabled && value.owners === 29 && value.frame >= hidden.frame;
    });
    if (!restored) continue;
    var draw = draws.find(function(value) {
      return value.sourcePlacementId === '327' && value.rootRevision === restored.rootRevision &&
        value.round === restored.round && value.count > 0 && value.lastFrame >= restored.frame;
    });
    transitions.push({sourcePlacementId: '327', rootRevision: hidden.rootRevision,
      hiddenRound: hidden.round, restoredRound: restored.round,
      hiddenFrame: hidden.frame, restoredFrame: restored.frame,
      actualDrawAfterRestore: Boolean(draw), draw: draw ?? null});
  }
  return {sourcePlacementId: '327', hiddenToVisibleRootObserved: transitions.length > 0,
    actualRestoredDrawObserved: transitions.some(function(value) {
      return value.actualDrawAfterRestore;
    }), transitions};
}
