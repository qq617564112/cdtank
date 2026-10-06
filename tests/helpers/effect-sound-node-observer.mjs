/** Observe the actual type4 node caller without inferring the nearest effect. */
export function observeEffectSoundNodes(NodeState, backend, instances, onPlay) {
  const update = NodeState.prototype.update;
  const play = backend.play;
  let context;
  NodeState.prototype.update = function(...args) {
    const previous = context;
    context = this;
    try {
      return update.apply(this, args);
    } finally {
      context = previous;
    }
  };
  backend.play = function(reference, parameter) {
    const voiceHandle = play.call(this, reference, parameter);
    let instance;
    let node;
    if (context) {
      for (const candidate of instances()) {
        const match = candidate.tree.nodes.find(value => value.sound === context);
        if (match) {
          instance = candidate;
          node = match;
          break;
        }
      }
    }
    onPlay({reference, parameter, voiceHandle, instance, node});
    return voiceHandle;
  };
  return () => {
    NodeState.prototype.update = update;
    backend.play = play;
  };
}
