# Map 0006 obj05432 source-load proposal

This is the next formal-consumer proposal for the legal mode1/2/3 Map 0006 scene. It is limited to the six original `obj05432` Breach placements and does not add a route or player acceptance claim.

## Source basis

- `recovery/docs/scene-breach06-05432-intact-material.md` records the original `object02`, FVF21/kind0, 168 expanded vertices, `obj05432A.tga`, and the source-to-published GLB/PNG verification.
- `recovery/output/scene-breach06-05432-intact-material-source.json` and `scene-breach06-05432-intact-material-module.json` provide the source and owner/clear contract.
- The published mesh is `object02/0`; the existing material shader contract is opaque, WRAP/LINEAR, LESS, and depth-write enabled.

## Exact future hunk

After an explicit production window, the only production changes should be:

- `apps/web/src/assets/scenes/scene-preview.ts` at the Breach model selection: extend the Map 0006 model tuple by appending `obj05432`, preserving its current `obj05421`, `obj05423`, `obj05443`, and `obj05433` members.
- `apps/web/src/assets/scenes/scene-breach-material.ts` around `register()` lines 10–12: add the named `obj05432` union member, mesh `object02/0`, and a `breach06-05432-intact` prefix. Preserve the existing `obj05421`, `obj05423`, and default mappings.

This proposal adds only `obj05432`; it preserves the released `obj05443` and `obj05433` consumers.

## Boundary

This qualifies formal source loading and intact material ownership only. The recorded `source133` footprint planner has no path and `source139` is not a valid NAV point, so no Chrome, route, pixel, normal-Leave, destruction, audio, or collision claim is made. The hunk waits for the next explicit unified release and one final type check.
