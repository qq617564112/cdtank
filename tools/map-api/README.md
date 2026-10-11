# Map object textures

The inventory covers placed scene objects, breakable objects and their fragments, castle actions, and structures embedded in map geometry. Static mesh selections retain buildings, walls, fences, vegetation and decoration. Ground surfaces, roads, terrain, sky, sound and standalone effects are excluded.

Map 1002 uses the original geometry and artwork sources of map 0002. Its higher resolution exports are not generation references. Map 1001's brick and steel objects use their own original geometry and UVs, with the original brick and metal artwork identified by `textureAliases`. The steel artwork is processed only for the object; its use on map 0018's ground remains unchanged.

References come from `art/original/`. An image present only inside an original GLB is decoded without modification; `originalSource` identifies that GLB image. Each API request redraws one complete original atlas with an opaque gray background and fixed white UV and canvas guides. Requests preserve the cartoon artwork, colors, shapes, counts, lettering, orientation and UV layout.

`process.py prepare OBJECT --workspace WORKTREE` prepares the complete reference. `generate` submits it through the shared image API channel and saves the native result. Each worktree has one request slot; all worktrees and tank jobs share five global slots. Service errors have at most three attempts. `--revision` submits the original complete atlas again with revised instructions.

`finish` removes the canvas frame, registers generated artwork to the original UV geometry, removes guide contamination, extends generated edge colors for texture filtering, and restores the original alpha. Runtime textures retain the source aspect ratio with a 4096-pixel longest edge. Metadata records both native and final dimensions.

Identical complete originals can reuse a self-reviewed native atlas. Reuse requires matching original pixels and prepared reference pixels, and each destination model is reviewed separately. `reuse.json` records the matching original references.

`flock /tmp/cdtank-api4k/map-render.lock node render.mjs OBJECT WORKTREE` renders original GLB geometry under uniform ambient illumination from six directions. Breakable states, castle actions and texture variants are included. Static objects use representative complete mesh groups covering every selected material. `contact.py OBJECT WORKTREE` produces original/API comparison sheets for visual inspection.

Production evidence is stored in `output/imagegen/map-api4k/OBJECT/`. Runtime textures are stored in `apps/web/public/map-audit/api4k/` under their original `Data/scnobj/` or `Data/map/` paths. Each completed object records inspected models and evidence in `review.json`.
