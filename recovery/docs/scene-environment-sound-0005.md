# 0005 environment sounds

Map5 consumes original Sound161/BG06, Sound217/SE08, Sound218/BG12 and Sound219/BG11 through MapEnvironmentSound. The standard scene exporter publishes its dedicated0005 library, and the runtime includes map5. Existing legal mode1/2/3 room entries and Battle loading/cleanup supply the ordinary lifecycle.

The source records are enabled with gain1, interval0 and randomGate0. `scene-environment-sound05-source.json` verifies all four original world positions, complete sound tails and published fields, plus byte-identical original WAVs. The shared native Sound loader and manager supplies selector−1 looping, zero-interval updates without repeated starts, reference distance100, maximum distance1600 and rolloff2. SE08 retains the same original placement contract as the BG emitters.

| Layer | State |
| --- | --- |
| source | Four exact original sound placements/tails and WAVs; shared original zero-interval spatial-loop contract |
| module | Dedicated0005 library/exporter, standard scene hook and runtime map5 eligibility |
| ordinary wire | Existing Battle map loading and sound cleanup through legal map5 |
| actual | Normal mode1 dual001/twoCPU/Ready/autopilot original voice playback/loop, exact spatial gain and nonzero browser output; Leave/re-entry/Leave audio cleanup |

`browser-scene-environment-sound05-2026-10-04T08-03-22-927Z.json` records the accepted ordinary battle. All four source WAVs trigger playing and naturally rewind on both pages. The panners preserve their original world positions; the shared EffectRuntime context is running and ordinary camera motion updates the listener.

| Webpage | BG06/SE08/BG12/BG11 actual rewinds | Maximum browser output amplitude | BG06/SE08/BG12/BG11 maximum spatial gain |
| --- | --- | --- | --- |
|1|1 / 10 / 1 / 2|0.0827990547|0 / 0.3249345124 / 0.6042135358 / 0.6042248011|
|2|1 / 10 / 1 / 2|0.0963957086|0 / 0.3649047315 / 0.2500184774 / 0.1859437823|

BG06 remains outside the recorded ordinary camera routes' audible range, and its zero gain matches the original distance cutoff. `scene-environment-sound05-actual.py` independently verifies source panner positions, WAV URLs/durations, loop rewinds and every recorded gain against the original distance formula, error below1e−6.

Ordinary Leave produces voice count0 and four old elements paused with source/panner/gain disconnected. New-room Create/Join/twoCPU/Ready re-entry creates four fresh active voices while those old elements remain paused. Final Leave produces count0 and all eight old elements paused/disconnected. `scene-environment-sound05-actual.json` records acceptance; `scene-environment-sound05-process-cleanup.json` confirms3319/5349/9549 closed with no dedicated process or temporary directory.

## Limitations

The acceptance uses diagnostic validation.html for an ordinary authoritative battle. Its parallel analyser tap reads the existing master signal with the normal destination connection active. This measures browser output, not human listening, OS speaker recording or original OpenAL sample equivalence. The existing Web backend uses equalpower panning and the original distance formula in a separate gain node. Emitters outside the ordinary camera's audible range retain zero gain.
