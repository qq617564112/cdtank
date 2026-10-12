# React home equipment

`apps/web/src/interface/home/home-equipment.tsx` exports `HomeEquipmentView` with
`open: boolean`, `close: () => void`, and `battle: Battle` props. The caller owns
the open state. The return button and Escape invalidate the current session and
call `close`. Each opening mounts a fresh session on PART with no candidate.

The view loads `ui.json`, `combat-catalog.json`, and source UI fonts, then queries
`Battle.inventory()`, `Battle.equipment({operation: 'QUERY'})`, and
`Battle.ownedRoles()`. The JSX controls retain source
`myhome_panzerpage.xml` rectangles and parent offsets, DDS-preferred assets,
`data-source-control`, `data-source-layout`, and `data-source-asset`. Existing
home CSS supplies the 615×396 stage and source font. Dialog zoom follows
`min(viewportWidth / 800, viewportHeight / 600)`.

PART lists categories 8–12; DECORATION lists category 5; MARK lists category 7.
Candidate rows retain their quantity, tooltip, selection state, and item detail.
The five part controls retain their source positions and honor the confirmed
`slotCount`. Occupied slots remain removable even beyond the current capacity.
The decoration and mark controls retain their separate instance IDs. Clicking a
slot sends EQUIP for the candidate; Delete sends UNEQUIP for the focused occupied
slot. The authority validates compatibility and ownership.

A synchronous session lock prevents repeated mutations. Pending requests disable
rows, tabs, and slots while the return button remains available. Only a successful
equipment response replaces confirmed slots and profile. Rejections retain those
values and show the error. Closing invalidates pending authority requests and
aborts resource fetches, so their results cannot update a reopened session.
Focus returns to the initiating slot after React commits enabled controls unless
the player has moved focus elsewhere. The native modal traps focus; bubbling
keyboard events stay within the equipment pane. Session cleanup restores the
previously focused connected control.

`apps/web/src/interface/home/home-equipment-preview.tsx` renders its own JSX host,
canvas, and status output. It resolves the selected owned tank through profile
offset `0xa8`, owned instance offset `0x1c`, tank ID offset `0x24`, and the owned
U/M/XY textures. The Babylon effect depends only on the tank ID, instance ID, and
texture values. Candidate changes, tab changes, pending controls, and equipment
responses for the same tank preserve the scene, orbit, and canvas. The preview
keeps the recovered clip planes and orbit increment. A ResizeObserver and window
resize callback size the canvas backing pixels to its zoomed display bounds.
After a zoom change commits, a layout effect resizes the existing engine to the
new display bounds without replacing the scene.

Closing disconnects the observer, removes the resize listener, cancels scheduled
resize animation frames, stops the render loop, and disposes the tank, scene, and
engine. Late model loads cannot publish a rendered tank into a closed session.
Reopening creates a new preview lifecycle. The existing HomeRoles preview remains
independent.

Validation: `npm --prefix apps/web run typecheck` passes. The real browser
equipment acceptance fixture covers authority changes, rejection, source
coordinates and assets, cosmetics, keyboard unequip, and persistence. Its closure
assertion should observe an unmounted dialog and stopped retained preview frames.
