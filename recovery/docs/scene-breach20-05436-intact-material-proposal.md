# Map20 obj05436 intact alpha material proposal

Fourteen enabled original Map0020 placements use plane02/0, FVF21/kind1,12 expanded vertices and obj05436.tga. `scene-breach20-05436-intact-material-source.json/.log` verifies original POL XYZ/UV/packed diffuse and DDS RGBA against the published GLB/PNG. The already accepted exact `scene-breach20-05436-native.json` intact loader uses blendmode0/alpha1 and is reused. Existing c9 destruction/GA12 consumers remain unchanged.

This asset requires the original kind1 geom_t_c1 contract. The current SceneBreachMaterial supports only kind0 geom_c1, so appending a model name alone cannot recover its alpha behavior. Existing SceneTerrainMaterial and `scene-terrain02-material-native.json` provide the kind1 texture-times-packed-diffuse, GREATER100 alpha-test contract. A future reviewed named05436 branch must retain this distinction while preserving every existing opaque Breach model.

Requested future scope:

- SceneBreachMaterial named obj05436/plane02/0/breach20-05436-intact and a kind1-only material branch using the existing original alpha contract.
- ScenePreview append obj05436 only to Map0020, preserving current unique cache registration, revision/load failure cleanup and owner restore before asset disposal.

No production change, type check, build, new native execution, Chrome, route, player pixels or Leave acceptance has occurred. This proposal follows05433 and later prepared opaque consumers, and needs exact shared review before implementation. The original14 placements are data coverage, not14 independently visible outputs.

Prepared exact material candidate: `recovery/prepared/scene-breach20-05436-alpha-material.patch`. It changes only the named05436 mapping and conditional kind1 fragment/options/metadata, preserving all existing opaque branches. This patch is not applied or type-checked; refresh against the reviewed current registry before a future authorized atomic integration.
