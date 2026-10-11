# Map object textures

The inventory covers placed scene objects, breakable objects and their fragments, castle actions, and structures embedded in map geometry. Static mesh selections retain buildings, walls, fences, vegetation and decoration. Ground surfaces, roads, terrain, sky, sound and standalone effects are excluded.

Map 1002 uses the original geometry and artwork sources of map 0002. Its higher resolution exports are not generation references. Map 1001's brick and steel objects use their own original geometry and UVs, with the original brick and metal artwork identified by `textureAliases`. The steel artwork is processed only for the object; its use on map 0018's ground remains unchanged.

References come from `art/original/`. An image present only inside an original GLB is decoded without modification; `originalSource` identifies that GLB image. Each API request redraws one complete original atlas enlarged with bilinear resampling, with a fixed white canvas frame. Transparent originals, including partially transparent pixels, are composited onto an opaque saturated purple background (`#FF00FF`); opaque originals use a gray canvas. The atlas interior retains the composited original pixels without added contour guides. Car references label the narrow underside shadow above the canvas frame; the label stays outside the atlas and is removed with the frame. Requests preserve the cartoon artwork, colors, shapes, counts, lettering and UV layout. Texture records can name the subject and rotate an upside-down complete atlas upright for generation; `finish` restores its original UV orientation.

The API preserves the uploaded RGB colors, including purple blends inside partially transparent artwork and along its edges. Foreground recovery and background removal take place in `finish`.

`process.py prepare OBJECT --workspace WORKTREE` prepares the complete reference. `generate` requests `max` output quality through the shared image API channel and saves the native result. Each worktree has one request slot; all worktrees and tank jobs share seven global slots. Service errors have at most three attempts. `--revision` submits the original complete atlas again with revised instructions.

`finish` removes the canvas frame, registers generated artwork to the original UV geometry, removes the recorded background matte and guide contamination along alpha edges, extends generated edge colors for texture filtering, and restores the original alpha. Purple-matte removal retains foreground colors without excess purple and cleans green contamination introduced by the inversion using neighboring colors from the same native atlas. Runtime textures retain the source aspect ratio with a 4096-pixel longest edge. Metadata records the reference background, orientation, and native and final dimensions.

Identical complete originals can reuse a self-reviewed native atlas from the worktree or integrated resources. Reuse requires matching original pixels and prepared reference pixels, and each destination model is reviewed separately. `reuse.json` records the matching original references.

`flock /tmp/cdtank-api4k/map-render.lock node render.mjs OBJECT WORKTREE` renders original GLB geometry under uniform ambient illumination from six directions. Breakable states, castle actions and texture variants are included. Static objects use representative complete mesh groups covering every selected material. `contact.py OBJECT WORKTREE` produces original/API comparison sheets for visual inspection.

After the complete initial render, `render.mjs OBJECT WORKTREE --group NAME` refreshes one static mesh group's six-view comparisons and retains the other groups in `renders/scope.json`. Render each group affected by a changed texture; accepted groups keep their existing evidence.

Production evidence is stored in `output/imagegen/map-api4k/OBJECT/`. Runtime textures are stored in `apps/web/public/map-audit/api4k/` under their original `Data/scnobj/` or `Data/map/` paths. Each completed object records inspected models and evidence in `review.json`.

Visual review covers artwork sampled by the original model UVs. Content outside those UVs does not affect acceptance or trigger a redraw. Self-reviewed passed groups remain accepted, and received native atlases are retained for model review.

`publish.py --independent-review REVIEW_FOLDER --require-complete` packages only groups with passed self and independent visual reviews. It publishes the catalog and original/API model states for `tools/asset-viewer/map-api.html`. The viewer filters by map, object, model state and texture variant, and switches between original and 4K textures while retaining the camera position. Static models show the complete selected object groups; ground meshes are excluded.

`--install-runtime` also installs the approved textures into `art/hd/` and the runtime models, retaining each existing model's geometry and all unselected ground, water and sky textures. Map 1002 receives the same reviewed textures as its standard originals. The original source files remain in `art/original/`.
