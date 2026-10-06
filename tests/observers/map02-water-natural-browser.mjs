/** Natural water draw observation; install after Login, before Create/Join. */
export async function installMap02WaterNaturalObserver() {
  window.waterNatural = {draws: [], counts: {water: 0, waves: 0}, loads: 0};
  var {Battle} = await import('/src/match/battle.ts');
  var reconcile = Battle.prototype.reconcile;
  Battle.prototype.reconcile = function(...args) {
    window.waterNaturalBattle = this;
    return reconcile.apply(this, args);
  };
  var {SceneWater} = await import('/src/assets/scenes/scene-water.ts');
  var load = SceneWater.prototype.load;
  SceneWater.prototype.load = async function(mapId) {
    var result = await load.call(this, mapId);
    if (mapId !== '0002' || this.disposed) return result;
    window.waterNatural.loads++;
    var owner = this;
    for (var container of this.containers) {
      for (var mesh of container.meshes) {
        var name = mesh.metadata?.sourceSceneWater;
        if (!name || !mesh.getTotalVertices()) continue;
        mesh.onBeforeRenderObservable.add(function(mesh, name) {
          return function() {
            window.waterNatural.counts[name]++;
            if (!window.waterNaturalStage) return;
            var rows = window.waterNatural.draws;
            var previous = rows.at(-1);
            var frame = mesh.getScene().getFrameId();
            if (previous?.name === name && previous.frame === frame) return;
            if (rows.length >= 120) return;
            var texture = mesh.material?.albedoTexture;
            rows.push({name, stage: window.waterNaturalStage, frame, at: performance.now(),
              vertices: mesh.getTotalVertices(), texture: texture?.url,
              vOffset: texture?.vOffset, textureIndex: owner.textureIndex,
              offset: owner.offset, world: Array.from(mesh.getWorldMatrix().m)});
          };
        }(mesh, name));
      }
    }
    return result;
  };
}
