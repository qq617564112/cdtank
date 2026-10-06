import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';

var require = createRequire(import.meta.url);
var WebSocket = require('ws');
var endpoint = process.argv[2];
var origin = process.argv[3] ?? 'http://127.0.0.1:5173';
if (!endpoint) {
  throw new Error('Usage: node tests/browser-effect-sound.mjs <Chromium CDP WebSocket URL> [origin]');
}
var ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => {
  ws.once('open', resolve);
  ws.once('error', reject);
});
var sequence = 0;
var pending = new Map();
ws.on('message', raw => {
  var message = JSON.parse(String(raw));
  var callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    var id = ++sequence;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}

async function evaluate(sessionId, expression) {
  var result = await command('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

/** Run the actual owner and browser media lifecycle with original GA resources. */
async function acceptance() {
  var {EffectSound} = await import('/src/audio/effect-sound.ts');
  var {EffectRuntimeTree} = await import('/src/render/effects/runtime/effect-runtime-tree.ts');
  var catalog = await (await fetch('/audio.json')).json();
  var library = await (await fetch('/effect-library.json')).json();
  var track = catalog.sounds.find(row => row.name === 'GA01');
  var mixedTrack = catalog.sounds.find(row => row.name === 'GA12');
  function check(condition, message) {
    if (!condition) throw new Error(message);
  }
  async function until(predicate, message, timeout = 15000) {
    var deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(message);
  }
  check(track && mixedTrack, 'Original GA01/GA12 catalog resources missing');
  var context = new AudioContext();
  await context.resume();
  var owners = [];
  function owner() {
    var sound = new EffectSound();
    owners.push(sound);
    return sound;
  }
  var handles = [];
  function play(sound, reference, parameter = 0) {
    var handle = sound.play(reference, parameter);
    handles.push(handle);
    return handle;
  }
  async function advancing(audio) {
    await until(() => !audio.paused && audio.currentTime > 0,
      'Actual GA playback failed to advance: ' + audio.src);
    check(!audio.error && audio.duration > 0, 'Original GA resource did not decode');
  }
  try {
    var sound = owner();
    sound.configure(catalog);
    var natural = play(sound, track.name.toLowerCase());
    var voice = sound.voices.get(natural);
    var audio = voice?.audio;
    var endedObserved = false;
    audio?.addEventListener('ended', () => {endedObserved = true;}, {once: true});
    check(audio instanceof HTMLAudioElement, 'Type4 owner did not create real HTMLAudioElement');
    check(audio.src.endsWith('/' + track.asset), 'Case-insensitive original catalog lookup');
    check(audio.volume === catalog.defaultSoundVolume, 'Catalog default sound volume');
    check(!sound.finished(natural), 'Voice finished before original GA playback');
    var source = context.createMediaElementSource(audio);
    var analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyser.connect(context.destination);
    var samples = new Float32Array(analyser.fftSize);
    var peak = 0;
    await until(() => {
      analyser.getFloatTimeDomainData(samples);
      for (var value of samples) peak = Math.max(peak, Math.abs(value));
      return peak > 0 && !audio.paused && audio.currentTime > 0;
    }, 'Original GA playback produced no audible samples');
    var playback = {name: track.name, time: audio.currentTime, duration: audio.duration, peak};
    await until(() => endedObserved && audio.ended, 'Original GA playback never naturally ended');
    check(sound.finished(natural), 'Ended event did not complete Type4 handle');
    check(sound.voices.has(natural), 'Fixture did not exercise owner ended-voice pruning');
    sound.update();
    check(!sound.voices.has(natural) && sound.finished(natural), 'Ended Type4 voice retained after update');

    var active = play(sound, track.name);
    var activeAudio = sound.voices.get(active).audio;
    await advancing(activeAudio);
    sound.setVolume(.25);
    check(activeAudio.volume === .25, 'Volume did not reach active Type4 voice');
    var future = play(sound, mixedTrack.name);
    var futureAudio = sound.voices.get(future).audio;
    check(futureAudio.volume === .25, 'Future Type4 voice lost volume');
    sound.stop(active);
    check(activeAudio.paused && !sound.voices.has(active) && sound.finished(active),
      'Stop must pause real media and delete its handle');
    sound.stop(future);
    check(futureAudio.paused && !sound.voices.has(future), 'Second Type4 stop retained playback');

    var preconfigured = owner();
    preconfigured.setVolume(.375);
    preconfigured.configure(catalog);
    var before = preconfigured.play(track.name, 0);
    var beforeAudio = preconfigured.voices.get(before).audio;
    check(beforeAudio.volume === .375, 'Configure overwrote volume set before catalog');
    await advancing(beforeAudio);
    preconfigured.stop(before);

    var missing = play(sound, '__missing_type4_reference__');
    check(sound.finished(missing) && !sound.voices.get(missing).audio,
      'Missing Type4 reference did not finish without media');
    sound.update();
    check(!sound.voices.has(missing), 'Missing-reference Type4 handle retained');

    // This catalog fixture causes a genuine HTMLMediaElement play rejection.
    var rejected = owner();
    rejected.configure({sounds: [{name: 'missing-media', asset: 'audio/sound/__missing_type4_media__.wav'}],
      defaultSoundVolume: catalog.defaultSoundVolume});
    var rejectedHandle = rejected.play('MISSING-MEDIA', 0);
    var rejectedAudio = rejected.voices.get(rejectedHandle).audio;
    await until(() => rejectedAudio.error && rejected.finished(rejectedHandle),
      'Missing media did not reject actual browser playback and finish handle');
    var rejectedMedia = {code: rejectedAudio.error.code, src: rejectedAudio.src};
    rejected.update();
    check(!rejected.voices.has(rejectedHandle), 'Rejected Type4 voice retained after update');

    var clearA = play(sound, track.name);
    var clearB = play(sound, mixedTrack.name);
    var clearAudio = [sound.voices.get(clearA).audio, sound.voices.get(clearB).audio];
    await advancing(clearAudio[0]);
    sound.shared.last = clearB;
    var shared = sound.shared;
    sound.clear();
    check(clearAudio.every(media => media.paused) && sound.voices.size === 0,
      'Clear did not pause and delete all actual Type4 voices');
    check(sound.shared === shared && shared.last === undefined, 'Clear retained shared descriptor');
    var afterClear = play(sound, track.name);
    check(handles.every((handle, index) => index === 0 || handle > handles[index - 1]),
      'Type4 handles are not monotonic across completion, stop, prune and clear');
    check(afterClear > clearB && sound.voices.get(afterClear).audio.volume === .25,
      'Clear reset Type4 sequence or selected volume');
    sound.stop(afterClear);

    // Exercise the original mixed online006 tree with an explicit stopPrevious fixture.
    var mixed = owner();
    mixed.configure(catalog);
    var previous = mixed.play(track.name, 0);
    var previousAudio = mixed.voices.get(previous).audio;
    await advancing(previousAudio);
    mixed.shared.last = previous;
    var control = library.soundControls.find(row => row.node === 2973);
    check(control?.reference === mixedTrack.name, 'Original online006 GA12 control changed');
    control.stopPrevious = true;
    var order = [];
    var originalStop = mixed.stop.bind(mixed);
    var originalPlay = mixed.play.bind(mixed);
    mixed.stop = handle => {
      order.push({kind: 'stop', handle});
      originalStop(handle);
    };
    mixed.play = (reference, parameter) => {
      if (reference === mixedTrack.name) {
        check(previousAudio.paused && !mixed.voices.has(previous),
          'Mixed Type4 replacement played before previous real audio was stopped');
      }
      var handle = originalPlay(reference, parameter);
      order.push({kind: 'play', handle, reference, parameter});
      return handle;
    };
    var root = library.nodes[2504];
    var tree = new EffectRuntimeTree(library, root.id, [0, 0, 0], undefined, () => .5,
      mixed, mixed.shared);
    tree.start();
    tree.update(.01);
    var gaNode = tree.nodes.find(node => node.definition.index === 2973);
    var mixedHandle = gaNode?.sound?.handle;
    check(tree.nodes.some(node => node.sprite) && tree.nodes.some(node => node.particle) &&
      tree.nodes.some(node => node.strip), 'Fixture no longer contains mixed source node types');
    check(order[0]?.kind === 'stop' && order[0]?.handle === previous &&
      order[1]?.kind === 'play' && order[1]?.reference === mixedTrack.name,
      'Original mixed tree lost stopPrevious ordering: ' + JSON.stringify(order));
    check(mixedHandle > previous && mixed.finished(previous), 'Mixed tree lost shared Type4 backend ownership');
    var mixedAudio = mixed.voices.get(mixedHandle)?.audio;
    check(mixedAudio instanceof HTMLAudioElement && mixedAudio.src.endsWith('/' + mixedTrack.asset),
      'Mixed tree did not play original GA12 through extracted owner');
    await advancing(mixedAudio);
    tree.dispose();
    check(mixedAudio.paused && mixed.voices.size === 0, 'Mixed tree disposal retained real Type4 playback');
    mixed.clear();
    check(mixed.shared.last === undefined, 'Mixed owner clear retained shared descriptor');
    return {playback, naturalEnd: true, endedPruning: true, defaultVolume: catalog.defaultSoundVolume,
      activeFutureVolume: .25, volumeBeforeConfigure: .375, missingReference: true, rejectedMedia,
      stop: true, clear: true, handles, mixedTree: {root: root.name, nodeCount: tree.nodes.length, order, disposed: true}};
  } finally {
    for (var soundOwner of owners) soundOwner.clear();
    await context.close();
  }
}

var targetId;
try {
  ({targetId} = await command('Target.createTarget', {url: origin, newWindow: true}));
  var {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  var ready = false;
  var deadline = Date.now() + 45000;
  while (!ready && Date.now() < deadline) {
    try {
      ready = await evaluate(sessionId, 'document.readyState === "complete" && location.origin === ' +
        JSON.stringify(new URL(origin).origin));
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
    }
    if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, 'Browser did not navigate to supplied origin');
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', x: 600, y: 100, button: 'left', clickCount: 1}, sessionId);
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', x: 600, y: 100, button: 'left', clickCount: 1}, sessionId);
  var evidence = await evaluate(sessionId, '(' + acceptance.toString() + ')()');
  assert.ok(evidence.playback.peak > 0);
  assert.ok(evidence.mixedTree.nodeCount > 1);
  await writeFile('recovery/output/browser-effect-sound.json', JSON.stringify(evidence, null, 2));
  console.log('PASS: real Type4 GA output, natural end/pruning, case-insensitive catalog, volume, monotonic handles, missing/rejected media, stop and clear');
  console.log('PASS: original online006 mixed tree plays GA12 through extracted owner, stops previous audio before replacement, and disposes voices');
} finally {
  if (targetId) await command('Target.closeTarget', {targetId});
  ws.close();
}
