/** Install before Create/Join; observes ordinary rounds, resource owners and HD frames. */
export async function installMap04FullSessionObserver() {
  window.map04Session = {stage: 'login', phase: null, transitions: [], recentSnapshots: [],
    events: [], frames: [], loads: [], clears: []};
  var scenes = new WeakSet();
  var {Battle} = await import('/src/match/battle.ts');
  var reconcile = Battle.prototype.reconcile;
  Battle.prototype.reconcile = function(snapshot, ...args) {
    window.map04Battle = this;
    var result = reconcile.call(this, snapshot, ...args);
    if (snapshot.roomInfo?.mapId !== 4) return result;
    var evidence = window.map04Session;
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
        window.map04Session.frames.push({frame: scene.getFrameId(), at: now, delta: now-last,
          stage: window.map04Session.stage, phase: window.map04Session.phase,
          width: engine.getRenderWidth(), height: engine.getRenderHeight(),
          hardwareScaling: engine.getHardwareScalingLevel()});
        last = now;
      });

    }
    return result;
  };
  var {BattleSound} = await import('/src/audio/battle-sound.ts');
  var event = BattleSound.prototype.event;
  BattleSound.prototype.event = function(value, ...args) {
    window.map04Session.events.push({...value});
    return event.call(this, value, ...args);
  };
  var {ScenePreview} = await import('/src/assets/scenes/scene-preview.ts');
  var load = ScenePreview.prototype.load;
  ScenePreview.prototype.load = async function(...args) {
    var result = await load.apply(this, args);
    if (args[0] === '0004' && result) {
      window.map04Session.loads.push({at: performance.now(), revision: this.revision,
        plantRoots: this.plantRoots.size, plantOwners: this.plants?.owners.size ?? 0,
        breakables: Array.from(this.breakables, function([id, value]) {
          return {id, brokenModel: value.broken?.model,
            meshCount: value.broken?.renderer?.meshes.length ?? 0};
        }), assets: this.assets.length});
    }
    return result;
  };
  var clear = ScenePreview.prototype.clear;
  ScenePreview.prototype.clear = function() {
    var result = clear.call(this);
    window.map04Session.clears.push({at: performance.now(), roots: this.plantRoots.size,
      snapshots: this.plantSnapshots.size, round: this.plantRound ?? null});
    return result;
  };
}
