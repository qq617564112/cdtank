# 0011 environment sound

Map11 consumes its original Sound426/BG08 through MapEnvironmentSound. The standard scene exporter publishes the dedicated0011 sound library and the runtime includes map11. Its legal mode1/2/3 room entries and Battle map lifecycle supply ordinary loading and cleanup.

The original emitter is enabled at `[-1169,0,1374.3299560546875]`, gain1, interval0 and randomGate0. The source check compares the entire original sound tail and placement with the published fields and verifies byte-identical original BG08 WAV content. Shared native Sound loader and manager evidence from map20 supplies selector−1 looping, zero-interval updates without extra starts, reference distance100, maximum distance1600 and rolloff2.

| Layer | State |
| --- | --- |
| source | Original Sound426 placement/tail and BG08 WAV; shared native zero-interval spatial-loop contract |
| module | Dedicated sound library/exporter hook and MapEnvironmentSound11 eligibility |
| ordinary wire | Legal map11 passed by existing Battle map loading and sound cleanup |
| actual | Normal mode1 dual001/twoCPU/Ready/autopilot: original voice playback/loop, exact spatial gain and nonzero browser output; Leave/re-entry/Leave releases the audio nodes |

`browser-scene-environment-sound11-2026-10-04T07-30-11-781Z.json` records the accepted ordinary dual-web battle. Both webpages play the original25.4954195011-second BG08 WAV and naturally rewind once. The sound shares the running EffectRuntime audio context, its panner preserves Sound426's original position, and listener motion comes from the ordinary camera following the players.

| Webpage | Playback samples | Listener states | Minimum / maximum spatial gain | Maximum browser output amplitude |
| --- | --- | --- | --- | --- |
|1|51|35|0 / 0.7526990175|0.0138046527|
|2|50|40|0 / 0.7928963304|0.0330422185|

The zero-gain samples preserve the original audible-distance cutoff. Ordinary movement eventually brings both players inside the source's range. `scene-environment-sound11-actual.py` independently verifies source positions, source WAV URL/duration, actual loop rewind and each recorded gain against the original listener-distance formula, with error below1e−6.

Ordinary Leave gives voice count0 and the old BG08 element paused with source/panner/gain disconnected. New-room Create/Join/twoCPU/Ready re-entry creates one fresh active voice while the old element remains paused. Final Leave gives count0 and both old elements paused/disconnected. `scene-environment-sound11-actual.json` records the acceptance; `scene-environment-sound11-process-cleanup.json` confirms3317/5347/9547 closed and no dedicated process or temporary directory.

## Limitations

The acceptance uses diagnostic validation.html for an ordinary authoritative battle. Its observer samples a parallel analyser tap on the existing audio master, retaining the normal destination connection. This measures decoded playback and mixed browser output, not human listening, OS speaker recording or original OpenAL sample equivalence. Spatial sound uses the existing equalpower panner and original distance formula in a separate gain node.
