# 0022 environment sounds

Map22 consumes its three original `SYcScnObjSound` placements through `MapEnvironmentSound`: Sound169/BG06, Sound170/BG11 and Sound171/BG12. The standard scene exporter publishes a dedicated sound library. The runtime adds map22 to the existing environment-sound map eligibility.

All three records are enabled, gain1, interval0 and randomGate0. Their original positions remain the spatial emitter positions. The existing original Sound loader and manager evidence supplies selector−1 looping, reference distance100, maximum distance1600, rolloff2, and zero-interval updates without repeated starts. The source check verifies each complete placement tail, the published fields and byte-identical original WAV files.

| Source ID | Original sound | WAV duration (seconds) |
| --- | --- | --- |
|169|BG06|12.3984580499|
|170|BG11|9.6260317460|
|171|BG12|20.8172789116|

`scene-environment-sound22-source.json` records the source fields and shared native contract. Original loader and manager execution is reused from `scene-environment-sound20-native.json` and the selector−1 OpenAL record in `skill-effect-actor-native.json`.

`browser-scene-environment-sound22-2026-10-04T06-44-33-982Z.json` records ordinary mode5/map22 dual001 webpages, twoCPU, Ready and autopilot with default autoplay. All three original WAVs trigger `playing`; each voice naturally rewinds at the WAV duration. The shared EffectRuntime context is running and all panners remain at the source positions while the camera listener changes.

| Webpage | BG06/BG11/BG12 actual rewinds | Maximum mixed output amplitude | BG06/BG11/BG12 maximum distance gain |
| --- | --- | --- | --- |
|1|1 / 2 / 1|0.0097278953|0.2026459277 / 0 / 0|
|2|1 / 2 / 1|0.0457842834|0.7988194227 / 0.1920828521 / 0.3167067170|

The first page's sampled route remains outside the audible distance for BG11/BG12; their zero gains match the original formula. The second page enters the distance range for all three sources. `scene-environment-sound22-actual.py` independently verifies the original positions, WAV durations, loop rewinds and every recorded gain against the source listener distance, with error below1e−6.

Ordinary Leave gives voice count0 and three paused old audio elements with source/panner/gain disconnected. Re-entry through ordinary Create/Join/twoCPU/Ready creates three fresh active voices while the old three remain paused. The second Leave gives count0 and all six old elements paused/disconnected. The independent result is `scene-environment-sound22-actual.json`; `scene-environment-sound22-process-cleanup.json` verifies ports3315/5345/9545 closed and no dedicated processes or temporary directories.

## Limitations

The browser acceptance uses the diagnostic `validation.html` entry for an ordinary authoritative battle. The output observer reads a parallel analyser tap on the existing master gain; the normal master-to-destination connection remains active. This verifies a nonzero mixed browser output signal, playback clocks and spatial gain. Human listening, OS speaker recording and sample-equivalent original OpenAL sound-device output are not measured. Web Audio uses the existing equalpower panner and the original linear-clamped distance formula in a separate gain node.
