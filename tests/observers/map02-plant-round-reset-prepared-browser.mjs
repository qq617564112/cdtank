/** Read-only source327 round attribution; install before Create/Join. */
export async function installMap02PlantRoundResetObserver() {
  window.plantRoundReset = {draws: [], roots: []};
  var {ScenePreview} = await import('/src/assets/scenes/scene-preview.ts');
  var roundState = new WeakMap();
  var register = ScenePreview.prototype.registerPlant;
  ScenePreview.prototype.registerPlant = function(id, root, sourceEnabled) {
    var result = register.call(this, id, root, sourceEnabled);
    if (id !== '327') return result;
    var preview = this;
    for (var mesh of root.getChildMeshes()) {
      if (mesh.metadata?.sourcePlantSway !== '327' || !mesh.getTotalVertices()) continue;
      mesh.onBeforeRenderObservable.add(function(mesh) {
        return function() {
          var state = roundState.get(preview);
          if (!state) return;
          var frame = mesh.getScene().getFrameId();
          var row = window.plantRoundReset.draws.find(function(value) {
            return value.rootRevision === state.rootRevision && value.round === state.round;
          });
          if (!row) {
            row = {sourcePlacementId: '327', rootRevision: state.rootRevision,
              round: state.round, count: 0, firstFrame: frame, lastFrame: frame};
            window.plantRoundReset.draws.push(row);
          }
          row.count++;
          row.lastFrame = frame;
        };
      }(mesh));
    }
    return result;
  };
  var reconcile = ScenePreview.prototype.reconcilePlants;
  ScenePreview.prototype.reconcilePlants = function(states, round) {
    var result = reconcile.call(this, states, round);
    roundState.set(this, {round, rootRevision: this.revision});
    var state = states.find(function(value) {return value.sourcePlacementId === '327';});
    var owner = this.plantRoots.get('327');
    if (!state || !owner) return result;
    var previous = window.plantRoundReset.roots.at(-1);
    if (!previous || previous.rootRevision !== this.revision || previous.round !== round ||
        previous.hidden !== state.hidden || previous.rootEnabled !== owner.root.isEnabled()) {
      window.plantRoundReset.roots.push({sourcePlacementId: '327', rootRevision: this.revision,
        round, hidden: state.hidden, rootEnabled: owner.root.isEnabled(),
        sourceEnabled: owner.sourceEnabled, owners: this.plantRoots.size,
        frame: this.scene.getFrameId(), at: performance.now()});
    }
    return result;
  };
}
