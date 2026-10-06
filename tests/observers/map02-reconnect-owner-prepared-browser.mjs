/** Install after Login and the environment observer, before Create/Join. */
export async function installMap02ReconnectOwnerObserver() {
  var identities = new WeakMap();
  var nextIdentity = 0;
  var audioRefs = new Map();
  var battle;
  var snapshot;
  var evidence = {checkpoints: []};
  window.map02ReconnectOwners = evidence;

  function identity(value) {
    if (!value) return null;
    if (!identities.has(value)) identities.set(value, ++nextIdentity);
    return identities.get(value);
  }

  var {Battle} = await import('/src/match/battle.ts');
  var reconcile = Battle.prototype.reconcile;
  Battle.prototype.reconcile = function(value, ...args) {
    var result = reconcile.call(this, value, ...args);
    if (value.roomInfo?.mapId === 2) {
      battle = this;
      snapshot = value;
    }
    return result;
  };

  /** Read live owners and retained audio references at a driver checkpoint. */
  window.captureMap02ReconnectOwners = function(label) {
    if (!battle) return null;
    var field = battle.battlefield;
    var sound = battle.environmentSound;
    var voices = Array.from(sound?.voices.values() ?? []).map(function(voice) {
      var audioId = identity(voice.audio);
      audioRefs.set(audioId, {id: voice.placement.id, audio: voice.audio});
      return {id: voice.placement.id, name: voice.placement.name,
        voiceOwner: identity(voice), audioOwner: audioId, src: voice.audio.src,
        paused: voice.audio.paused, ended: voice.audio.ended, loop: voice.audio.loop};
    });
    var row = {label, at: performance.now(),
      roomId: snapshot.roomId, playerId: battle.playerId, session: battle.session,
      phase: snapshot.phase, round: snapshot.match?.round,
      active: battle.active, mapLoaded: battle.mapLoaded,
      battleOwner: identity(battle), sceneOwner: identity(battle.scene),
      previewOwner: identity(field), previewRevision: field.revision,
      waterOwner: identity(field.water), waterContainers: field.water?.containers.length ?? 0,
      plantOwner: identity(field.plants), plantOwners: field.plants?.owners.size ?? 0,
      plantRoots: Array.from(field.plantRoots, function([id, value]) {
        return {id, rootOwner: identity(value.root), sourceEnabled: value.sourceEnabled,
          enabled: value.root.isEnabled()};
      }),
      plantSnapshots: Array.from(field.plantSnapshots.values(), function(value) {
        return {...value};
      }),
      soundOwner: identity(sound), soundRevision: sound?.revision ?? null, voices,
      retainedAudio: Array.from(audioRefs, function([audioOwner, value]) {
        return {id: value.id, audioOwner, paused: value.audio.paused,
          ended: value.audio.ended, src: value.audio.src};
      }),
      resources: {players: battle.players.size, breakables: field.breakables.size,
        plantRoots: field.plantRoots.size, plantLedger: field.plantSnapshots.size,
        effects: battle.effects.instances.length,
        sceneVoices: battle.effects.skillSound.voices.size,
        battleVoices: battle.sound.voices.size},
      environmentRecordCounts: {plants: window.map02Environment.plants.length,
        water: window.map02Environment.water.length,
        sounds: window.map02Environment.sounds.length,
        lifecycle: window.map02Environment.lifecycle.length}};
    evidence.checkpoints.push(row);
    return row;
  };
}
