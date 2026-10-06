/** Install before Create/Join; observes ordinary rounds, resource owners and HD frames. */
export async function installMap02FullSessionObserver() {
  window.map02Session = {stage: 'login', phase: null, transitions: [], recentSnapshots: [],
    events: [], frames: [], castleDraws: {}, plantStates: [], clears: []};
  var scenes = new WeakSet();
  var {Battle} = await import('/src/match/battle.ts');
  var reconcile = Battle.prototype.reconcile;
  Battle.prototype.reconcile = function(snapshot, ...args) {
    window.map02Battle = this;
    var result = reconcile.call(this, snapshot, ...args);
    if (snapshot.roomInfo?.mapId !== 2) return result;
    var evidence = window.map02Session;
    evidence.phase = snapshot.phase;
    var previous = evidence.transitions.at(-1);
    if (!previous || previous.roomId !== snapshot.roomId || previous.round !== snapshot.match?.round || previous.phase !== snapshot.phase) {
      evidence.transitions.push({at: performance.now(), roomId: snapshot.roomId,
        round: snapshot.match?.round, phase: snapshot.phase, snapshot});
    }
    evidence.recentSnapshots.push({tick: snapshot.tick, phase: snapshot.phase,
      players: snapshot.players, match: snapshot.match});
    if (evidence.recentSnapshots.length > 32) evidence.recentSnapshots.shift();
    if (!scenes.has(this.scene)) {
      scenes.add(this.scene);
      var scene = this.scene;
      var last = performance.now();
      scene.onAfterRenderObservable.add(function() {
        var now = performance.now();
        var engine = scene.getEngine();
        window.map02Session.frames.push({frame: scene.getFrameId(), at: now, delta: now-last,
          stage: window.map02Session.stage, phase: window.map02Session.phase,
          width: engine.getRenderWidth(), height: engine.getRenderHeight(),
          hardwareScaling: engine.getHardwareScalingLevel()});
        last = now;
      });
      scene.onBeforeRenderObservable.add(function() {
        for (var mesh of scene.meshes) {
          if (mesh.metadata?.sourceCastlePlacementId !== '305' || mesh.map02CastleObserved || !mesh.getTotalVertices()) continue;
          mesh.map02CastleObserved = true;
          mesh.onBeforeRenderObservable.add(function(mesh) {
            return function() {
              var metadata = mesh.metadata;
              var key = metadata.sourceCastleAction + ':' + mesh.name;
              var row = window.map02Session.castleDraws[key];
              if (!row) {
                row = window.map02Session.castleDraws[key] = {id: '305',
                  model: metadata.sourceCastleModel, action: metadata.sourceCastleAction,
                  mesh: mesh.name, vertices: mesh.getTotalVertices(),
                  textures: mesh.material?.getActiveTextures().map(texture => texture.url),
                  firstFrame: scene.getFrameId(), count: 0};
              }
              row.count++;
              row.lastFrame = scene.getFrameId();
            };
          }(mesh));
        }
      });
    }
    return result;
  };
  var {BattleSound} = await import('/src/audio/battle-sound.ts');
  var event = BattleSound.prototype.event;
  BattleSound.prototype.event = function(value, ...args) {
    window.map02Session.events.push({...value});
    return event.call(this, value, ...args);
  };
  var {ScenePreview} = await import('/src/assets/scenes/scene-preview.ts');
  var reconcilePlants = ScenePreview.prototype.reconcilePlants;
  ScenePreview.prototype.reconcilePlants = function(states, round) {
    var result = reconcilePlants.call(this, states, round);
    var value = this.plantRoots.get('327');
    var state = states.find(state => state.sourcePlacementId === '327');
    var prior = window.map02Session.plantStates.at(-1);
    if (value && state && (!prior || prior.round !== round || prior.hidden !== state.hidden)) {
      window.map02Session.plantStates.push({round, ...state, rootEnabled: value.root.isEnabled(),
        sourceEnabled: value.sourceEnabled, owners: this.plantRoots.size, at: performance.now()});
    }
    return result;
  };
  var clear = ScenePreview.prototype.clear;
  ScenePreview.prototype.clear = function() {
    var result = clear.call(this);
    window.map02Session.clears.push({at: performance.now(), roots: this.plantRoots.size,
      snapshots: this.plantSnapshots.size, round: this.plantRound ?? null});
    return result;
  };
}
