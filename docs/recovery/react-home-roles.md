# React home roles

`apps/web/src/interface/home/home-roles.tsx` exports `HomeRolesView` with
`open: boolean`, `close: () => void`, and `battle: Battle` props. The caller owns
the open state. The last tank/pet tab persists across openings; each opening
mounts a fresh session with no candidate and queries `Battle.ownedRoles()` and
`Battle.roleProfile()` alongside source UI assets and fonts.

The JSX retains the owned tank and pet lists, current role labels, selection
buttons, model/name controls, original source rectangles and parent offsets,
DDS-preferred images, and source control/layout/asset metadata. Tank instance IDs
come from owned field `0x1c`, pet instance IDs from owned field `0`, and confirmed
profile offsets `0xa8` and `0xa4` identify the current tank and pet. The dialog
uses the 615×396 source stage and scales by
`min(viewportWidth / 800, viewportHeight / 600)`.

Selecting a row changes the candidate and its detail. Selecting a tab resets the
candidate. The use button sends `Battle.selectRole({kind, instanceId})`; only the
confirmed response replaces the profile. A rejection restores the candidate to
the confirmed current role and shows the error. A synchronous pending lock
prevents repeated requests, and pending requests disable the list, tabs, use,
and camouflage controls. Return and Escape close the session, invalidate late
responses, and abort resource fetches. A reopened session has independent state.

The native dialog handles modal focus and keyboard button activation. Keyboard
events stay within the pane. After a request settles, focus returns to its use
button when enabled, or to the selected owned row, unless the player has moved
focus. Closing restores the previously focused connected control.

Tank previews use the JSX `HomeEquipmentPreview` in an independent scene.
The displayed owned record supplies the instance ID, tank field `0x24`, and
U/M/XY texture slots, without catalog substitution. The mounted preview owns one
engine, scene, camera, render loop, and observer. Changing the tank ID, instance
ID, or U/M/XY source values disposes the old tank model and loads its replacement
within that scene. Pending state and confirmations for the same displayed tank
retain the model too. Camera orientation and orbit persist across model changes.
Choosing the pet tab removes the tank preview. Pet selection
uses the recovered list and name controls.

Changing camouflage mounts `HomeTankTextureSelectionView` with the displayed
owned tank, confirmed profile, source UI, battle interface, and close/confirmation
callbacks. Its confirmed ownership/profile response updates the parent view.
Its preview scene is separate from the parent tank scene. Closing the roles
session also unmounts the child and both preview lifecycles.

Each model load has a cleanup token; superseded loads dispose their results
without replacing the active model. Closing invalidates the scene before
cleanup removes browser subscriptions, stops rendering, and disposes the current
model, scene, and engine. Late model loads cannot publish into closed sessions. Resize
and zoom changes resize backing pixels to the displayed bounds while preserving
the scene.

Validation: web TypeScript compilation covers the JSX interfaces and callbacks.
The role browser fixture exercises tank/pet authority, rejection, source images
and geometry, 1080p/4K sizing, keyboard/mouse selection, persistence, and owned
tank previews. React closure assertions observe removed dialogs/previews and
disposed retained scene witnesses.
