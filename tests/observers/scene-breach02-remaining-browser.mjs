/** Install dedicated read-only acceptance observers in the ordinary browser. */
export async function installSceneBreach02RemainingObserver() {
  var source = await (await fetch('/src/render/scene-runtime.ts')).text();
  var url = source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1];
  var {EngineStore} = await import(url);
  var engine = EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));
  var scene = engine.scenes[0];
  window.breachScene = scene;
  window.breach = {events: [], sounds: [], draws: [], counts: {}, visuals: [], calls: [],
    captures: {}, frames: 0, current: {}, worlds: [], firstDraw: [], actualFrames: []};
  var firstBrokenDraws = {};
  var targets = {'117': 'obj05425', '123': 'obj05426', '401': 'obj05422'};
  var cues = {'117': 'GA32', '123': 'GA32', '401': 'GA13'};
  var {Battle} = await import('/src/match/battle.ts');
  var reconcile = Battle.prototype.reconcile;
  Battle.prototype.reconcile = function(...args) {
    window.breachBattle = this;
    return reconcile.apply(this, args);
  };
  var {ScenePreview} = await import('/src/assets/scenes/scene-preview.ts');
  var destroy = ScenePreview.prototype.destroyObject;
  ScenePreview.prototype.destroyObject = function(id, sound) {
    window.breach.calls.push({id, frame: window.breach.frames});
    var previous = window.breach.currentDestroy;
    window.breach.currentDestroy = id;
    try {
      return destroy.call(this, id, sound);
    } finally {
      window.breach.currentDestroy = previous;
    }
  };
  var {BattleSound} = await import('/src/audio/battle-sound.ts');
  var event = BattleSound.prototype.event;
  BattleSound.prototype.event = function(e, ...args) {
    window.breach.events.push(e);
    return event.call(this, e, ...args);
  };
  window.breach.results = [];
  window.breach.resultEffects = [];
  window.breach.resultSounds = [];
  window.breach.resultFeedbackSounds = [];
  var {TankShotItemResult} = await import('/src/assets/tanks/shot-item-result.ts');
  var showResult = TankShotItemResult.prototype.show;
  TankShotItemResult.prototype.show = function(message, attackerId, localId, feedback) {
    var row = {message: {...message}, attackerId, localId, local: attackerId === localId,
      frame: window.breach.frames, feedback: 0};
    window.breach.results.push(row);
    var previous = window.breach.currentResult;
    window.breach.currentResult = row;
    try {
      return showResult.call(this, message, attackerId, localId, function() {
        row.feedback++;
        feedback();
      });
    } finally {
      window.breach.currentResult = previous;
    }
  };
  var {EffectRuntime} = await import('/src/render/effects/runtime/effect-runtime.ts');
  window.breach.resultSpawns = [];
  var spawnResult = EffectRuntime.prototype.spawnWorldEffect;
  EffectRuntime.prototype.spawnWorldEffect = function(reference, origin, ...args) {
    var handle = spawnResult.call(this, reference, origin, ...args);
    if (window.breach.currentResult) window.breach.resultSpawns.push({
      result: window.breach.currentResult, reference, origin: [...origin], handle,
      frame: window.breach.frames});
    return handle;
  };
  var addResultInstance = EffectRuntime.prototype.addInstance;
  EffectRuntime.prototype.addInstance = function(view, tree) {
    var handle = addResultInstance.call(this, view, tree);
    if (tree.root.definition.index === 2432 && window.breach.currentResult) {
      var instance = this.instances.find(value => value.handle === handle);
      var row = {handle, result: window.breach.currentResult, root: 2432,
        owner: view?.root.name ?? null, world: !tree.parentMatrix,
        nodes: instance.draws.map(value => value.node.definition.index), draws: [], expired: false};
      window.breach.resultEffects.push(row);
      instance.breachResultRow = row;
    }
    return handle;
  };
  var drawResult = EffectRuntime.prototype.draw;
  EffectRuntime.prototype.draw = function(instance, value) {
    var result = drawResult.call(this, instance, value);
    var row = instance.breachResultRow;
    var mesh = value.sprite?.mesh ?? value.particle?.sprite.mesh ?? value.overlay?.mesh;
    if (row && mesh && !mesh.breachResultObserved) {
      mesh.breachResultObserved = true;
      mesh.onBeforeRenderObservable.add(function() {
        var node = value.node.definition.index;
        if (!row.draws.some(draw => draw.node === node)) {
          row.draws.push({node, frame: window.breach.frames + 1,
            vertices: mesh.getTotalVertices(), texture: mesh.material.getActiveTextures()[0]?.url});
        }
      });
    }
    return result;
  };
  var removeResult = EffectRuntime.prototype.remove;
  EffectRuntime.prototype.remove = function(index) {
    var instance = this.instances[index];
    if (instance.breachResultRow) instance.breachResultRow.expired = instance.tree.quiescent;
    return removeResult.call(this, index);
  };
  var {EffectSound} = await import('/src/audio/effect-sound.ts');
  var playResultSound = EffectSound.prototype.play;
  EffectSound.prototype.play = function(reference, parameter) {
    var handle = playResultSound.call(this, reference, parameter);
    if (reference === 'SE30' && window.breach.currentResult) {
      var voice = this.voices.get(handle);
      var row = {result: window.breach.currentResult, handle, reference, parameter,
        src: voice?.audio.src, playing: false, ended: false};
      window.breach.resultSounds.push(row);
      voice?.audio.addEventListener('playing', function() {row.playing = true;});
      voice?.audio.addEventListener('ended', function() {row.ended = true;});
    }
    return handle;
  };
  var resultFeedback = BattleSound.prototype.shotItemResult;
  BattleSound.prototype.shotItemResult = function(value, ...args) {
    var before = new Set(this.voices);
    var result = resultFeedback.call(this, value, ...args);
    for (var voice of this.voices) {
      if (before.has(voice)) continue;
      var row = {result: window.breach.currentResult, value, ...this.history.at(-1),
        loop: voice.source.loop, ended: false};
      window.breach.resultFeedbackSounds.push(row);
      voice.source.addEventListener('ended', function(record) {
        return function() {record.ended = true;};
      }(row));
    }
    return result;
  };
  var {EffectSkillSound} = await import('/src/audio/effect-skill-sound.ts');
  var play = EffectSkillSound.prototype.play;
  EffectSkillSound.prototype.play = function(reference, selector, position) {
    var handle = play.call(this, reference, selector, position);
    if (reference === cues[window.breach.currentDestroy]) {
      var voice = this.voices.get(handle);
      var row = {sourcePlacementId: window.breach.currentDestroy, handle, reference, selector,
        position: [...position], playing: false, ended: false, loop: voice?.audio.loop, src: voice?.audio.src};
      if(voice){const analyser=this.context.createAnalyser();analyser.fftSize=256;voice.gain.connect(analyser);row.outputPeak=0;row.masterGain=this.master.gain.value;voice.breachTap=analyser;voice.breachTimer=setInterval(()=>{const data=new Float32Array(256);analyser.getFloatTimeDomainData(data);const peak=Math.max(...data.map(Math.abs));if(peak>row.outputPeak){row.outputPeak=peak;row.outputGain=voice.gain.gain.value;}},20);}
      voice?.audio.addEventListener('playing', function() {row.playing = true;});
      voice?.audio.addEventListener('ended', function() {row.ended = true; row.duration = voice.audio.duration;});
      window.breach.sounds.push(row);
    }
    return handle;
  };
  var stop=EffectSkillSound.prototype.stop;EffectSkillSound.prototype.stop=function(handle){const voice=this.voices.get(handle);if(voice?.breachTimer){clearInterval(voice.breachTimer);voice.gain.disconnect(voice.breachTap);voice.breachTap.disconnect();}return stop.call(this,handle);};
  var libraries = await Promise.all(['/scene-breach-0014.json', '/scene-breach-0021.json'].map(async path => (await fetch(path)).json()));
  var library = {resources: libraries.flatMap(value => value.resources)};
  var geometryNodes = Object.fromEntries(library.resources.map(r=>[r.reference,r.nodes.map((n,i)=>n.parts.length?i:null).filter(i=>i!==null)]));
  window.breach.geometryNodes = geometryNodes;
  var {EffectModelRenderer} = await import('/src/render/effects/models/effect-model-renderer.ts');
  var drawModel = EffectModelRenderer.prototype.draw;
  EffectModelRenderer.prototype.draw = function(state) {
    var id = Object.keys(targets).find(id => window.breachBattle?.battlefield.breakables.get(id)?.broken?.renderer === this);
    if (!state || !id || window.breach.firstDraw.some(row => row.sourcePlacementId === id)) {
      return drawModel.call(this, state);
    }
    var before = this.meshes.map(mesh => ({vertices: mesh.getTotalVertices(),
      effectReady: mesh.material?.getEffect()?.isReady() ?? null}));
    var startedAt = performance.now();
    var result = drawModel.call(this, state);
    var elapsed = performance.now() - startedAt;
    var after = this.meshes.map(mesh => ({vertices: mesh.getTotalVertices(),
      effectReady: mesh.material?.getEffect()?.isReady() ?? null}));
    window.breach.firstDraw.push({sourcePlacementId: id, frame: window.breach.frames + 1,
      startedAt, elapsed, beforeCount: before.length, afterCount: after.length, before, after});
    return result;
  };
  var observe = function(mesh) {
    if(!mesh.onBeforeRenderObservable)return;
    mesh.onBeforeRenderObservable.add(function() {
      var id = mesh.metadata?.sourcePlacementId ?? mesh.name.split('/')[0];
      var value = window.breachBattle?.battlefield.breakables.get(id);
      if (!targets[id] || value?.broken?.model !== targets[id] || !mesh.getTotalVertices()) return;
      var broken = !!mesh.metadata?.sourceBreachBroken;
      var renderer = broken ? value.broken.renderer : undefined;
      var row = {id, model: value.broken.model, mesh: mesh.name, broken, frame: window.breach.frames + 1,
        vertices: mesh.getTotalVertices(), sourceModel: mesh.metadata?.sourceModel, node: mesh.metadata?.sourceModelNode,
        positions: Array.from(mesh.getVerticesData('position') ?? []), uvs: Array.from(mesh.getVerticesData('uv') ?? []),
        indices: Array.from(mesh.getIndices() ?? []), worldMatrix: Array.from(mesh.getWorldMatrix().m),
        textures: mesh.material?.getActiveTextures().map(texture => texture.url),
        placementMatrix: broken ? [...value.broken.matrix] : undefined,
        clocks: renderer?.animations.map(clock => clock ? {time: clock.time, loops: clock.loops, rate: clock.rate,
          matrix: [...clock.matrix]} : null)};
      var key = id + ':' + broken + ':' + (row.node ?? row.mesh);
      window.breach.counts[key] = (window.breach.counts[key] ?? 0) + 1;
      var previous = window.breach.draws.filter(draw => draw.mesh === row.mesh && draw.broken === broken);
      if (previous.length < 3 && !previous.some(draw => JSON.stringify(draw.positions) === JSON.stringify(row.positions))) {
        window.breach.draws.push(row);
      }
      if (broken) {
        window.breach.current[id] ??= [];
        window.breach.current[id].push(row);
      }
    });
  };
  scene.meshes.forEach(observe);
  scene.onNewMeshAddedObservable.add(observe);
  scene.onAfterRenderObservable.add(function() {
    window.breach.frames++;
    var raw = document.querySelector('#battle-status')?.dataset.world;
    if (!raw || !window.breachBattle) {window.breach.current = {}; return;}
    var world = JSON.parse(raw);
    if (window.breach.frames % 20 === 0) window.breach.worlds.push({frame: window.breach.frames, world});
    for (var [id, value] of window.breachBattle.battlefield.breakables) {
      if (!targets[id] || value.broken?.model !== targets[id]) continue;
      var visual = value.state.snapshot();
      var key = id + ':' + world.match.round + ':' + visual.fading + ':' + visual.hidden;
      if (!window.breach.visuals.some(row => row.key === key)) {
        window.breach.visuals.push({key, id, ...visual, intactEnabled: value.root.isEnabled(),
          round: world.match.round, frame: window.breach.frames, world});
      }
      var draws = window.breach.current[id] ?? [];
      if (draws.length) window.breach.actualFrames.push({id, frame: window.breach.frames,
        observedAt: performance.now(), alpha: visual.alpha, nodes: draws.map(draw => draw.node),
        effectReady: draws.map(draw => ({node: draw.node,
          ready: value.broken.renderer.meshes.find(mesh => mesh.metadata?.sourceModelNode === draw.node)
            ?.material?.getEffect()?.isReady() ?? null}))});
      var first = firstBrokenDraws[id];
      var positionsChanged = !!first && draws.some(draw => first.draws.some(previous =>
        previous.node === draw.node && JSON.stringify(previous.positions) !== JSON.stringify(draw.positions)));
      if (draws.length && !first) firstBrokenDraws[id] = {frame: window.breach.frames, draws};
      if (world.phase === 'PLAYING' && first && first.frame !== window.breach.frames && positionsChanged &&
        new Set(draws.map(draw => draw.node)).size >= geometryNodes['Data/scnobj/'+value.broken.model+'/c9.CVD'].length &&
        !window.breach.captures[id]) {
        var camera = scene.activeCamera;
        var encodeStartedAt = performance.now();
        var canvas = engine.getRenderingCanvas().toDataURL('image/png');
        var encodeDuration = performance.now() - encodeStartedAt;
        window.breach.captures[id] = {id, model: value.broken.model, frame: window.breach.frames, world,
          alpha: visual.alpha, draws, encodeStartedAt, encodeDuration,
          camera: {view: Array.from(camera.getViewMatrix().m),
            projection: Array.from(camera.getProjectionMatrix().m), position: camera.globalPosition.asArray(),
            target: camera.target.asArray(), width: engine.getRenderWidth(), height: engine.getRenderHeight()},
          canvas};
      }
    }
    window.breach.current = {};
  });
}
