# Tank texture production

Each request edits one original body or turret atlas with an opaque neutral background and fixed perimeter guides. The image API receives the original UV layout and a high-quality 4096-pixel request. Rectangular atlases retain their source aspect ratio.

Every redraw regenerates the complete atlas from `art/original/tank-textures/role/`. Inputs are prepared afresh from that source for each request. Previous API outputs, local redraws, masks for selective editing, and artwork patches are not generation references. If visual review fails, submit the original complete atlas again with revised instructions. `finish` performs UV registration and guide cleanup without applying saved correction patches.

`process.py prepare TANK --workspace WORKTREE` writes bounded inputs and prompts. `generate` saves native API images and their actual dimensions. `generate --detach` starts an independent image job; its PID and log are in the tank's output directory. `finish` registers artwork to the existing model UVs, removes perimeter guides, retains small color samples, and writes RGB textures with padded UV edges. Unedited source pixels remain available to the model's material for color sampling.

`node render.mjs TANK WORKTREE` renders every skin through the game's actual `TankView`, GLB models, and MV3 materials. Each skin has original/API images from six fixed directions under uniform ambient light. `--only SUFFIX` renders a single skin. `contact.py TANK --workspace WORKTREE` builds the review sheets.

Production files are stored in `output/imagegen/tank-api4k/TANK/`; runtime textures are in `apps/web/public/tank-audit/api4k/TANK/`. Per-image metadata distinguishes native API dimensions from final dimensions. Review records describe the skins and directions actually inspected.
