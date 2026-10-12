# Map 18/20/22 client loading

This note records the current production loading range for map18, map20 and map22. It covers the existing scene, objective, Breach, effect and environment-sound consumers only. It does not close the original full-map, original rules, real-time dual-client or HD-performance parent items.

## Placement and consumer counts

| Map | Source placements | Breach | General | Effect | Sound | Resolved static records |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0018 | 44 | 34 | 4 | 0 | 6 | 38 |
| 0020 | 123 | 117 | 0 | 5 | 1 | 117 |
| 0022 | 49 | 46 | 0 | 0 | 3 | 46 |

`scene-placements.json` supplies the source placement id, model, position and matrix. For these maps, `ScenePreview` consumes every resolved Breach model through its published damage library and existing `SceneBreachVisual`; `SceneBreachState` owns playback and fade. The maps have no Plant placements, so no plant registry entry is added.

| Map | Breach library | Models |
| --- | --- | --- |
| 0018 | `/scene-breach-0018.json` | `obj05424`, `obj05442` |
| 0020 | `/scene-breach-0020.json` | `obj05460`, `obj05461`, `obj05462`, `obj05442`, `obj05434`, `obj05435`, `obj05436` |
| 0022 | `/scene-breach-0022.json` | `obj05424`, `obj05469` |

## Runtime ownership

The battle lifecycle loads `ScenePreview` with the four-digit map id. `ScenePreview` loads `scene-placements.json`, the terrain, resolved model containers, map materials and each published Breach library. For each source placement it keeps the source id, model, matrix-derived rotation/scale and reflected scene position. Authoritative `objectives` and `sceneObjects` snapshots then drive intact, morphed, broken, destroyed, restored and new-round states without local damage inference.

Map18 General records 66-69 use their existing `scene-animation-0018.json` CVD consumer. Map20 Effect records 269-273 use `scene-effects-0020.json`; `MapSceneEffects` owns the five retained effect handles and releases them on map clear or scene dispose. Map20 and map22 environment sounds use the same `MapEnvironmentSound` owner as the other maps: placement fields come from `scene-environment-sound-<map>.json`, source WAVs come from `audio.json`, and the manager is retained across rounds until room cancellation, leave, or scene dispose.

Late asynchronous loads are rejected by the current revision checks. A load result that has been superseded is disposed or released without becoming active in the scene.

## Known issues

Map18 has six original `SYcScnObjSound` records, ids 57-62, all naming `BG07`. The original `BG07` WAV remains absent from verified source data and the search report. `export_audio.py` now appends the explicitly reconstructed `reconstructed/battle/BG07.wav` while the source file is absent, so the unchanged map18 placements resolve through the shared catalog. Browser playback and source-audio equivalence are not established here.

All three map22 environment sound records have `intervalMs=0` and `randomGate=false`; they use the retained loop lifecycle rather than interval scheduling. The current published environment-sound tables have no non-zero interval records.

The original full-map rendering, original HP/attack rules, real-time dual-client acceptance and HD performance for maps 18, 20 and 22 remain unverified here.
