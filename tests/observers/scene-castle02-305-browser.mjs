/** Observe source305 only; install after Login and before normal Create/Join. */
export async function installSceneCastle02Observer() {
  var evidence = {events: [], transactions: [], draws: [], sounds: [], captures: {}};
  window.castle305 = evidence;
  var current;
  var scenes = new WeakSet();
  var {ScenePreview} = await import('/src/assets/scenes/scene-preview.ts');
  var damage = ScenePreview.prototype.damageCastle;
  ScenePreview.prototype.damageCastle = function(result) {
    if (result.castleId !== '305') return damage.call(this, result);
    var previous = current;
    var row = {...result, at: performance.now()};
    evidence.transactions.push(row);
    current = row;
    try {return damage.call(this, result);} finally {current = previous;}
  };
  var {Battle} = await import('/src/match/battle.ts');
  var reconcile = Battle.prototype.reconcile;
  Battle.prototype.reconcile = function(snapshot, ...args) {
    var result = reconcile.call(this, snapshot, ...args);
    window.castle305Battle = this;
    if (snapshot.roomInfo?.mapId !== 2 || scenes.has(this.scene)) return result;
    scenes.add(this.scene);
    var scene = this.scene;
    scene.onBeforeRenderObservable.add(function() {
      for (var mesh of scene.meshes) {
        if (mesh.metadata?.sourceCastlePlacementId !== '305' || !mesh.getTotalVertices() || mesh.castle305Observed) continue;
        mesh.castle305Observed = true;
        mesh.onBeforeRenderObservable.add(function(mesh) {
          return function() {
            var metadata = mesh.metadata;
            var action = metadata.sourceCastleAction;
            var frame = scene.getFrameId();
            var row = {id: '305', model: metadata.sourceCastleModel, action,
              mesh: mesh.name, frame, at: performance.now(), vertices: mesh.getTotalVertices(),
              worldMatrix: Array.from(mesh.getWorldMatrix().m),
              textures: mesh.material?.getActiveTextures().map(function(texture) {return texture.url;})};
            evidence.draws.push(row);
          };
        }(mesh));
      }
    });
    scene.onAfterRenderObservable.add(function() {
      var frame = scene.getFrameId();
      for (var action of ['c2', 'n2', 'c3']) {
        if (evidence.captures[action]) continue;
        var draws = evidence.draws.filter(function(row) {return row.action === action;});
        if (!draws.some(function(row) {return row.frame === frame;}) || new Set(draws.map(function(row) {return row.frame;})).size < 2) continue;
        var started = performance.now();
        var canvas = scene.getEngine().getRenderingCanvas().toDataURL('image/png');
        evidence.captures[action] = {action, frame, encodeDurationMs: performance.now() - started, canvas};
      }
    });
    return result;
  };
  var {BattleSound} = await import('/src/audio/battle-sound.ts');
  var event = BattleSound.prototype.event;
  BattleSound.prototype.event = function(value, ...args) {
    if (value.targetId === 'CASTLE:305') evidence.events.push({...value});
    return event.call(this, value, ...args);
  };
  var {EffectRuntime} = await import('/src/render/effects/runtime/effect-runtime.ts');
  var play = EffectRuntime.prototype.playSceneSound;
  EffectRuntime.prototype.playSceneSound = function(name, position, selector) {
    var handle = play.call(this, name, position, selector);
    if (!current) return handle;
    var voice = this.skillSound.voices.get(handle);
    var row = {sourcePlacementId: '305', name, handle, position: Array.from(position), selector,
      transaction: current, src: voice?.audio.src, loop: voice?.audio.loop, playing: voice ? !voice.audio.paused : false,
      ended: false, outputPeak: 0};
    evidence.sounds.push(row);
    if (voice) {
      var analyser = this.skillSound.context.createAnalyser();
      analyser.fftSize = 256;
      voice.gain.connect(analyser);
      var timer = setInterval(function() {
        var data = new Float32Array(256);
        analyser.getFloatTimeDomainData(data);
        row.outputPeak = Math.max(row.outputPeak, ...data.map(Math.abs));
        row.playing ||= !voice.audio.paused;
      }, 20);
      var finished = false;
      var finish = function() {
        if (finished) return;
        finished = true;
        row.pausedAtFinish = voice.audio.paused;
        row.timeAtFinish = voice.audio.currentTime;
        row.finishedAt = performance.now();
        clearInterval(timer);
        voice.gain.disconnect(analyser);
        analyser.disconnect();
      };
      voice.audio.addEventListener('ended', function() {row.ended = true; row.duration = voice.audio.currentTime; finish();}, {once: true});
      voice.audio.addEventListener('pause', finish, {once: true});
    }
    return handle;
  };
}
