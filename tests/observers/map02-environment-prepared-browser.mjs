/** Install after Login, before Create/Join; record Map02 actual draws and lifecycle. */
export async function installMap02EnvironmentObserver(observedMapId = 2) {
  var evidence = {plants: [], water: [], sounds: [], lifecycle: []};
  window.map02Environment = evidence;
  var plantOwners = new WeakSet();
  var soundOwners = new WeakSet();
  var {ScenePlantSway} = await import('/src/assets/scenes/scene-plant-sway.ts');
  var loadPlant = ScenePlantSway.prototype.load;
  ScenePlantSway.prototype.load = async function(mapId) {
    var result = await loadPlant.call(this, mapId);
    if (mapId === String(observedMapId).padStart(4, '0')) plantOwners.add(this);
    return result;
  };
  var registerPlant = ScenePlantSway.prototype.register;
  ScenePlantSway.prototype.register = function(id, root) {
    var result = registerPlant.call(this, id, root);
    if (!plantOwners.has(this)) return result;
    var owner = this.owners.get(id);
    var resource = this.resources.get(id);
    if (!owner || !resource) return result;
    for (var value of owner.meshes) {
      var row = {id, model: resource.model, mesh: value.mesh.name,
        source: Array.from(value.source), height: owner.height, samples: []};
      evidence.plants.push(row);
      value.mesh.onBeforeRenderObservable.add(function(value, row, owner) {
        return function() {
          if (row.samples.length >= 2) return;
          var positions = Array.from(value.mesh.getVerticesData('position') ?? []);
          if (row.samples.some(sample => JSON.stringify(sample.positions) === JSON.stringify(positions))) return;
          row.samples.push({frame: value.mesh.getScene().getFrameId(), at: performance.now(),
            phase: owner.phase, parameter: owner.parameter, positions,
            worldMatrix: Array.from(value.mesh.getWorldMatrix().m),
            texture: value.mesh.material?.getActiveTextures()[0]?.url});
        };
      }(value, row, owner));
    }
    return result;
  };
  var disposePlant = ScenePlantSway.prototype.dispose;
  ScenePlantSway.prototype.dispose = function() {
    var observed = plantOwners.has(this);
    var result = disposePlant.call(this);
    if (observed) evidence.lifecycle.push({kind: 'plantDispose', at: performance.now(),
      owners: this.owners.size, resources: this.resources.size, materialOwner: !!this.materialOwner});
    return result;
  };
  var {SceneWater} = await import('/src/assets/scenes/scene-water.ts');
  var loadWater = SceneWater.prototype.load;
  SceneWater.prototype.load = async function(mapId) {
    var result = await loadWater.call(this, mapId);
    if (mapId !== String(observedMapId).padStart(4, '0')) return result;
    for (var container of this.containers) {
      for (var mesh of container.meshes) {
        if (!mesh.getTotalVertices()) continue;
        var row = {kind: mesh.metadata?.sourceSceneWater, mesh: mesh.name,
          vertices: mesh.getTotalVertices(), samples: []};
        evidence.water.push(row);
        mesh.onBeforeRenderObservable.add(function(mesh, row) {
          return function() {
            if (row.samples.length >= 3) return;
            var textures = mesh.material?.getActiveTextures().map(texture => ({
              url: texture.url, uOffset: texture.uOffset, vOffset: texture.vOffset})) ?? [];
            if (row.samples.some(sample => JSON.stringify(sample.textures) === JSON.stringify(textures))) return;
            row.samples.push({frame: mesh.getScene().getFrameId(), at: performance.now(), textures});
          };
        }(mesh, row));
      }
    }
    return result;
  };
  var disposeWater = SceneWater.prototype.dispose;
  SceneWater.prototype.dispose = function() {
    var result = disposeWater.call(this);
    evidence.lifecycle.push({kind: 'waterDispose', at: performance.now(),
      containers: this.containers.length, textures: this.textures.length,
      water: !!this.water, wave: !!this.wave});
    return result;
  };
  var {MapEnvironmentSound} = await import('/src/audio/map-environment-sound.ts');
  var loadSound = MapEnvironmentSound.prototype.load;
  MapEnvironmentSound.prototype.load = async function(mapId) {
    var result = await loadSound.call(this, mapId);
    if (mapId !== observedMapId) return result;
    soundOwners.add(this);
    var row = {kind: 'soundLoad', at: performance.now(), revision: this.revision,
      voices: Array.from(this.voices.values()).map(voice => ({
        id: voice.placement.id, name: voice.placement.name, src: voice.audio.src,
        loop: voice.audio.loop, paused: voice.audio.paused, playing: false}))};
    evidence.sounds.push(row);
    Array.from(this.voices.values()).forEach(function(voice, index) {
      voice.audio.addEventListener('playing', function() {row.voices[index].playing = true;});
    });
    return result;
  };
  var clearSound = MapEnvironmentSound.prototype.clear;
  MapEnvironmentSound.prototype.clear = function() {
    var observed = soundOwners.has(this);
    var voices = Array.from(this.voices.values());
    var result = clearSound.call(this);
    if (observed) evidence.lifecycle.push({kind: 'soundClear', at: performance.now(),
      voices: this.voices.size, master: !!this.master, map: !!this.map,
      oldAudioPaused: voices.map(voice => ({id: voice.placement.id, paused: voice.audio.paused}))});
    return result;
  };
}
