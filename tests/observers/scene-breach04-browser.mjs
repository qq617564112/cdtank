/** Install dedicated read-only acceptance observers in the ordinary browser. */
export async function installSceneBreach04Observer() {
  var source = await (await fetch('/src/render/scene-runtime.ts')).text();
  var url = source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1];
  var {EngineStore} = await import(url);
  var engine = EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));
  var scene = engine.scenes[0];
  window.breachScene = scene;
  window.breach = {events: [], sounds: [], draws: [], counts: {}, visuals: [], calls: [],
    captures: {}, frames: 0, current: {}, worlds: []};
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
    window.breach.currentDestroy = id;
    var result = destroy.call(this, id, sound);
    window.breach.currentDestroy = undefined;
    return result;
  };
  var {BattleSound} = await import('/src/audio/battle-sound.ts');
  var event = BattleSound.prototype.event;
  BattleSound.prototype.event = function(e, ...args) {
    window.breach.events.push(e);
    return event.call(this, e, ...args);
  };
  var {EffectSkillSound} = await import('/src/audio/effect-skill-sound.ts');
  var play = EffectSkillSound.prototype.play;
  EffectSkillSound.prototype.play = function(reference, selector, position) {
    var handle = play.call(this, reference, selector, position);
    if (reference === 'GA13' && window.breach.currentDestroy !== undefined) {
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
  var library = await (await fetch('/scene-breach-0004.json')).json();
  var geometryNodes = Object.fromEntries(library.resources.map(r=>[r.reference,r.nodes.map((n,i)=>n.parts.length?i:null).filter(i=>i!==null)]));
  window.breach.geometryNodes = geometryNodes;
  var observe = function(mesh) {
    if(!mesh.onBeforeRenderObservable)return;
    mesh.onBeforeRenderObservable.add(function() {
      var id = mesh.metadata?.sourcePlacementId ?? mesh.name.split('/')[0];
      var value = window.breachBattle?.battlefield.breakables.get(id);
      if (value?.broken?.model !== 'obj05466' || !mesh.getTotalVertices()) return;
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
      if (value.broken?.model !== 'obj05466') continue;
      var visual = value.state.snapshot();
      var key = id + ':' + world.match.round + ':' + visual.fading + ':' + visual.hidden;
      if (!window.breach.visuals.some(row => row.key === key)) {
        window.breach.visuals.push({key, id, ...visual, intactEnabled: value.root.isEnabled(),
          round: world.match.round, frame: window.breach.frames, world});
      }
      var draws = window.breach.current[id] ?? [];
      if (world.phase === 'PLAYING' && new Set(draws.map(draw => draw.node)).size >= geometryNodes['Data/scnobj/'+value.broken.model+'/c9.CVD'].length && (!window.breach.captures[id] || draws.length > window.breach.captures[id].draws.length)) {
        var camera = scene.activeCamera;
        window.breach.captures[id] = {id, model: value.broken.model, frame: window.breach.frames, world,
          alpha: visual.alpha, draws, camera: {view: Array.from(camera.getViewMatrix().m),
            projection: Array.from(camera.getProjectionMatrix().m), position: camera.globalPosition.asArray(),
            target: camera.target.asArray(), width: engine.getRenderWidth(), height: engine.getRenderHeight()},
          canvas: engine.getRenderingCanvas().toDataURL('image/png')};
      }
    }
    window.breach.current = {};
  });
}
