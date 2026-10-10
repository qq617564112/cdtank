# Tank texture production

Each request edits one original body or turret atlas with an opaque neutral background and fixed perimeter guides. The image API receives the original UV layout and a high-quality 4096-pixel request. Rectangular atlases retain their source aspect ratio.

`process.py prepare TANK --workspace WORKTREE` writes bounded inputs and prompts. `generate` saves native API images and their actual dimensions. `generate --detach` starts an independent image job; its PID and log are in the tank's output directory. `finish` registers artwork to the existing model UVs, removes perimeter guides, retains small color samples, and writes RGBA textures with padded UV edges.

`node render.mjs TANK WORKTREE` renders every skin through the game's actual `TankView`, GLB models, and MV3 materials. Each skin has original/API images from six fixed directions under uniform ambient light. `--only SUFFIX` renders a single skin. `contact.py TANK --workspace WORKTREE` builds the review sheets.

Production files are stored in `output/imagegen/tank-api4k/TANK/`; runtime textures are in `apps/web/public/tank-audit/api4k/TANK/`. Per-image metadata distinguishes native API dimensions from final dimensions. Review records describe the skins and directions actually inspected.
