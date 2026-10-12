# React home inventory

`apps/web/src/interface/home/home-inventory.tsx` exports `HomeInventoryView` with
`open: boolean`, `close: () => void`, `battle: Battle`, optional `navigation` and
`onRolePage: (kind: "pet" | "tank") => void` props. The caller owns
whether the window is open; closing by the return button or Escape calls `close`. Each opening mounts a
new inventory session while preserving the selected weapon or item tab.

The 625×404 root uses the source `myhome.xml` frame, page radios and Close;
see [home-page-source.md](home-page-source.md) for root geometry and projection boundaries.

The view loads `ui.json`, `combat-catalog.json`, and the source UI fonts, and
queries the authenticated account through `Battle.inventory()`. Source
`myhome_playerpage.xml` rectangles, parent offsets, DDS-preferred image assets,
`data-source-control`, `data-source-layout`, and `data-source-asset` identify the
same controls and resources as the source pane. CSS zoom follows
`min(viewportWidth / 800, viewportHeight / 600)` and removes its resize listener
when the window closes.

The weapon tab shows four cells for slots 0–3; slot 0 is the disabled default
shell. The item tab shows slots 4–7. Rows expose their instance ID through
`data-inventory-instance`, selection through `aria-pressed`, and drag payloads
through `text/plain`. A selected row or a dragged row can be assigned to a
compatible tab's slot. Right click, Delete, and Backspace cancel the slot.

`Battle.configureKitbag()` receives `ASSIGN` or `CANCEL`. A synchronous pending
lock prevents repeated submissions, disables rows, tabs and editable slots, and
leaves the return button available. The view replaces its hotkeys only after a
successful authority response; rejection retains the confirmed state and shows
the error. Closing invalidates that opening's fetch and mutation responses, so
late results cannot update a reopened window. Dropped instances must belong to
the current tab's inventory records.

The native modal dialog traps focus. Keyboard events stay within the pane;
Escape requests closure. Closing restores the previously focused connected
control. Finishing a configuration request restores the previously focused
control after React commits enabled controls, unless the player has moved focus
to another control. Output text remains available through the native `output.value` API.
