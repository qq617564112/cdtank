/** Install after Login and before Create/Join for the new ordinary Plant contact. */
export async function installScenePlant02ContactObserver() {
  window.plantContact = {events: [], snapshots: [], rootStates: [], draws: {count: 0, lastFrame: null}};
  var {Battle} = await import('/src/match/battle.ts');
  var reconcile = Battle.prototype.reconcile;
  Battle.prototype.reconcile = function(...args) {
    window.plantContactBattle = this;
    var result = reconcile.apply(this, args);
    var world = this.roomFeed.snapshot;
    if (world?.roomInfo?.mapId === 2 && world.match?.scenePlants) {
      var state = world.match.scenePlants.find(value => value.sourcePlacementId === '327');
      var previous = window.plantContact.snapshots.at(-1);
      if (state && (!previous || previous.hidden !== state.hidden || previous.round !== world.match.round)) {
        window.plantContact.snapshots.push({tick: world.tick, round: world.match.round,
          ...state, player: world.players.find(player => player.id === this.playerId)});
      }
    }
    return result;
  };
  var {ScenePreview} = await import('/src/assets/scenes/scene-preview.ts');
  var registerPlant = ScenePreview.prototype.registerPlant;
  ScenePreview.prototype.registerPlant = function(id, root, sourceEnabled) {
    var result = registerPlant.call(this, id, root, sourceEnabled);
    if (id === '327') {
      for (var mesh of root.getChildMeshes()) {
        if (mesh.metadata?.sourcePlantSway !== id || !mesh.getTotalVertices()) continue;
        mesh.onBeforeRenderObservable.add(function(mesh) {
          return function() {
            window.plantContact.draws.count++;
            window.plantContact.draws.lastFrame = mesh.getScene().getFrameId();
          };
        }(mesh));
      }
    }
    return result;
  };
  var reconcilePlants = ScenePreview.prototype.reconcilePlants;
  ScenePreview.prototype.reconcilePlants = function(states, round) {
    var result = reconcilePlants.call(this, states, round);
    var state = states.find(value => value.sourcePlacementId === '327');
    var value = this.plantRoots.get('327');
    var previous = window.plantContact.rootStates.at(-1);
    if (state && value && (!previous || previous.hidden !== state.hidden || previous.round !== round)) {
      window.plantContact.rootStates.push({sourcePlacementId: '327', round, hidden: state.hidden,
        enabled: state.enabled, rootEnabled: value.root.isEnabled(), sourceEnabled: value.sourceEnabled,
        owners: this.plantRoots.size, at: performance.now(), frame: this.scene.getFrameId(),
        drawCount: window.plantContact.draws.count, lastDrawFrame: window.plantContact.draws.lastFrame});
    }
    return result;
  };
  var {BattleSound} = await import('/src/audio/battle-sound.ts');
  var event = BattleSound.prototype.event;
  BattleSound.prototype.event = function(value, ...args) {
    if (value.type === 'scenePlantHidden') window.plantContact.events.push({...value});
    return event.call(this, value, ...args);
  };
}
