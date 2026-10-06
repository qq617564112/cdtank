# Map 0004/0017 source-load proposal

This proposal records the two exact source-backed Preview/material additions for the next unified release. It does not claim a browser, route, normal-Leave, or pixel result.

## Map 0004

Map4 has 17 original `obj05466` placements and 21 original `obj05422` placements. The published `obj05466.glb` mesh is `object04/0`; the existing `obj05422` mapping is `cone78/0`.

Applied hunks:

- `apps/web/src/assets/scenes/scene-preview.ts:181-183`: include `0004` in the Breach material owner and register only `['obj05466', 'obj05422']` for this map.
- `apps/web/src/assets/scenes/scene-breach-material.ts:10-12`: add the named `obj05466 → object04/0` mapping with the `breach04-intact` prefix; retain the existing `obj05422 → cone78/0` mapping.

The existing `scene-preview.ts:279-282` destruction-library selection for `0004/obj05466` is reused unchanged.

## Map 0017

The remaining Map17 source-load target is the 12-placement `SYcScnObjBreach/obj05469` consumer. The published mesh is `cylinder02/0`, already represented by the existing model mapping.

Applied hunk:

- `apps/web/src/assets/scenes/scene-preview.ts:181-183`: include `0017` in the Breach material owner and register only `['obj05469']` for this map.

Terrain material qualification for both IDs is already present at `scene-preview.ts:121-129` and `scene-terrain-material.ts:43-50`; no terrain, placement, route, or native changes are proposed.

## Scope boundary

This is the reviewed minimal source/load and intact-material hunk. It does not establish player reachability, host or guest pixels, normal Leave, destruction, audio, or full-map completion. No browser, route, or independent build is part of this change.

正式有限主审：`recovery/output/map04-map17-intact-material-source-load-root-review.json`，状态 `ACCEPTED_MAP04_MAP17_ORIGINAL_MATERIAL_SOURCE_LOAD_SCOPE`。统一Web发行日志 `recovery/output/shop-owned-item-map04-map17-source-load-production-web-build.log`，session13049 actualexit0、2m17、releasecopy0。最终接线0004[05466,05422]/0017[05469]，具名05466 object04/0；必要type日志 `map4-map17-source-load-types.log` exit0。保留原普通入口缺口。
