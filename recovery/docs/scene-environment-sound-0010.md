# 0010 environment sounds

Map10 consumes four original environment sound placements through the existing MapEnvironmentSound lifecycle. Its standard scene export publishes Sound110/BG06, Sound111/BG01, Sound112/BG11 and Sound113/BG12. The runtime adds map10 eligibility; room rules and ordinary battle events remain the existing legal mode1/2/3 map10 rules.

The four original source records are enabled with gain1, interval0 and randomGate0. Their source world positions remain the spatial emitter positions. The shared original Sound loader and manager evidence supplies selector−1 looping, reference distance100, maximum distance1600, rolloff2 and zero-interval updates without repeated starts. `scene-environment-sound10-source.json` verifies all four complete tails, published fields and byte-identical original WAV files. The distinct BG01 source WAV lasts7.4934240363 seconds.

| Layer | Delivered state |
| --- | --- |
| source | Four exact original sound tails/world positions/enabled/gain/interval/random fields and identical WAV bytes; common native zero-interval loader/manager reused |
| module | Dedicated0010 sound export and standard exporter hook; existing MapEnvironmentSound includes10 |
| ordinary wire | Existing Battle map loading passes legal map10; mode1 dual001/twoCPU/Ready/autopilot without source/event/position injection |
| actual | All four voices play/loop; distance gain matches source formula; nonzero mixed browser output; ordinary Leave/re-entry/Leave clears retained audio nodes |

`browser-scene-environment-sound10-2026-10-04T07-08-59-166Z.json` records the accepted ordinary run. `scene-environment-sound10-actual.py` independently checks original panner positions, WAV URLs/durations, playback loop rewinds and all recorded spatial gains against the listener positions, error below1e−6.

| Webpage | BG06/BG01/BG11/BG12 actual rewinds | Maximum mixed output amplitude | BG06/BG01/BG11/BG12 maximum gain |
| --- | --- | --- | --- |
|1|2 / 3 / 2 / 1|0.0112247299|0 / 0.1490692496 / 0.2823531628 / 0.3799540997|
|2|2 / 3 / 2 / 1|0.0017938369|0 / 0 / 0.0659665614 / 0|

Zero gains remain in the table: the ordinary sampled camera routes lie beyond the original audible distance for those emitters. Page1 reaches the new BG01 emitter's distance range. The mixed output signal is nonzero on both webpages.

First Leave produces voice count0 and four old audio elements paused with source/panner/gain disconnected. Ordinary new-room Create/Join/twoCPU/Ready re-entry creates four fresh playing voices while the old four remain paused. Final Leave produces count0 with all eight old audio elements paused/disconnected. The dedicated cleanup record `scene-environment-sound10-process-cleanup.json` confirms3316/5346/9546 closed and no remaining processes or temporary directories.

## Limitations

The acceptance uses diagnostic validation.html for an ordinary authoritative battle. A parallel analyser tap reads the existing master output; its normal destination connection remains active. A nonzero browser mixed signal verifies decoded playback reaching that master, not human listening or OS speaker recording. Web Audio uses the existing equalpower panner and the original distance formula in a separate gain node. The original low-HP smoke/independent wreck creation contracts remain missing, and map18 BG07 remains absent rather than receiving a substitute.
