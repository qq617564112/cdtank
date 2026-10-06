/** Read-only observations for the first ordinary Crush07 transaction. */
export async function installSceneCrush07Observer() {
  var source = await (await fetch('/src/render/scene-runtime.ts')).text();
  var url = source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1];
  var {EngineStore} = await import(url);
  var engine = EngineStore.Instances.find(e => e.getRenderingCanvas() === document.querySelector('#world'));
  var scene = engine.scenes[0];
  window.crushScene = scene;
  window.crush07 = {frames: 0, events: [], calls: [], starts: [], releases: [], phases: [],
    draws: [], counts: {}, captures: {}, sounds: [], current: {}};
  var readWorld = function() {
    var raw = document.querySelector('#battle-status')?.dataset.world;
    return raw ? JSON.parse(raw) : undefined;
  };
  var {ScenePreview} = await import('/src/assets/scenes/scene-preview.ts');
  var advance = ScenePreview.prototype.advance;
  ScenePreview.prototype.advance = function(...args) {
    window.crushPreview = this;
    return advance.apply(this, args);
  };
  var crush = ScenePreview.prototype.crush;
  ScenePreview.prototype.crush = function(id) {
    window.crushPreview = this;
    var owner = this.crushes.get(id);
    var beforeEnabled = owner?.root.isEnabled();
    var beforeConsumedShot = owner?.consumedShot;
    var result = crush.call(this, id);
    window.crush07.calls.push({id, beforeEnabled, afterEnabled: owner?.root.isEnabled(),
      beforeConsumedShot, afterConsumedShot: owner?.consumedShot,
      parent: owner ? [...owner.matrix] : undefined,
      frame: window.crush07.frames, world: readWorld()});
    return result;
  };
  var {Battle} = await import('/src/match/battle.ts');
  var reconcile = Battle.prototype.reconcile;
  Battle.prototype.reconcile = function(...args) {
    window.crushBattle = this;
    return reconcile.apply(this, args);
  };
  var {EffectRuntime} = await import('/src/render/effects/runtime/effect-runtime.ts');
  var start = EffectRuntime.prototype.startCrushEffect;
  EffectRuntime.prototype.startCrushEffect = function(handle) {
    window.crushRuntime = this;
    var instance = this.instances.find(row => row.handle === handle && row.crushRetained);
    window.crush07.starts.push({handle, id: instance?.sourceScenePlacementId,
      parent: instance?.tree.parentMatrix ? [...instance.tree.parentMatrix] : undefined,
      soundNodes: instance?.tree.nodes.filter(node => node.sound)
        .map(node => ({index: node.definition.index, name: node.definition.name})),
      frame: window.crush07.frames, world: readWorld()});
    return start.call(this, handle);
  };
  var release = EffectRuntime.prototype.releaseSceneEffect;
  EffectRuntime.prototype.releaseSceneEffect = function(handle) {
    var instance = this.instances.find(row => row.handle === handle && row.crushRetained);
    if (instance) window.crush07.releases.push({handle, id: instance.sourceScenePlacementId,
      frame: window.crush07.frames, phases: instance.tree.nodes.map(node => node.lifecycle.phase)});
    return release.call(this, handle);
  };
  var update = EffectRuntime.prototype.update;
  EffectRuntime.prototype.update = function(...args) {
    window.crushRuntime = this;
    var result = update.apply(this, args);
    for (var instance of this.instances.filter(row => row.crushRetained)) {
      var phases = instance.tree.nodes.map(node => node.lifecycle.phase);
      var key = instance.handle + ':' + phases.join(',');
      if (!window.crush07.phases.some(row => row.key === key)) {
        window.crush07.phases.push({key, handle: instance.handle,
          id: instance.sourceScenePlacementId, phases, frame: window.crush07.frames,
          parent: [...instance.tree.parentMatrix], world: readWorld()});
      }
    }
    return result;
  };
  window.crush07.cleanup = function() {
    var runtime = window.crushRuntime;
    return {owners: window.crushPreview?.crushes.size,
      effects: runtime?.instances.length,
      retainedCrush: runtime?.instances.filter(row => row.crushRetained).length,
      meshes051: scene.meshes.filter(mesh => mesh.metadata?.sourceNode === 2971).length,
      sceneVoices: runtime?.skillSound.voices.size,
      battleVoices: window.crushBattle?.sound.voices.size};
  };
  var {BattleSound} = await import('/src/audio/battle-sound.ts');
  var event = BattleSound.prototype.event;
  BattleSound.prototype.event = function(value, ...args) {
    window.crush07.events.push(value);
    return event.call(this, value, ...args);
  };
  var {EffectSound} = await import('/src/audio/effect-sound.ts');
  var play = EffectSound.prototype.play;
  EffectSound.prototype.play = function(...args) {
    window.crush07.sounds.push({args, frame: window.crush07.frames});
    return play.apply(this, args);
  };
  var observe = function(mesh) {
    if (!mesh.onBeforeRenderObservable) return;
    mesh.onBeforeRenderObservable.add(function() {
      if (mesh.metadata?.sourceNode !== 2971 || !mesh.getTotalVertices()) return;
      var id = mesh.metadata.sourceScenePlacementId;
      var instance = window.crushRuntime?.instances.find(row =>
        row.crushRetained && row.sourceScenePlacementId === id);
      if (!instance) return;
      var positions = Array.from(mesh.getVerticesData('position') ?? []);
      if (!positions.length) return;
      var row = {id, handle: instance.handle, frame: window.crush07.frames,
        sourceNode: 2971, sourceName: mesh.metadata.originalEffect,
        positions, uvs: Array.from(mesh.getVerticesData('uv') ?? []),
        colors: Array.from(mesh.getVerticesData('color') ?? []),
        indices: Array.from(mesh.getIndices() ?? []),
        worldMatrix: Array.from(mesh.getWorldMatrix().m),
        parent: [...instance.tree.parentMatrix],
        textures: mesh.material?.getActiveTextures().map(texture => texture.url)};
      window.crush07.counts[id] = (window.crush07.counts[id] ?? 0) + 1;
      if (window.crush07.draws.filter(draw => draw.id === id).length < 3) window.crush07.draws.push(row);
      window.crush07.current[id] = row;
    });
  };
  scene.meshes.forEach(observe);
  scene.onNewMeshAddedObservable.add(observe);
  scene.onAfterRenderObservable.add(function() {
    window.crush07.frames++;
    var world = readWorld();
    if (world?.phase === 'PLAYING') {
      for (var [id, draw] of Object.entries(window.crush07.current)) {
        if (window.crush07.captures[id]) continue;
        var camera = scene.activeCamera;
        window.crush07.captures[id] = {id, draw, world, frame: window.crush07.frames,
          camera: {view: Array.from(camera.getViewMatrix().m),
            projection: Array.from(camera.getProjectionMatrix().m),
            position: camera.globalPosition.asArray(),
            width: engine.getRenderWidth(), height: engine.getRenderHeight()},
          canvas: engine.getRenderingCanvas().toDataURL('image/png')};
      }
    }
    window.crush07.current = {};
  });
}
