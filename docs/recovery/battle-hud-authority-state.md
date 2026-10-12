# Battle HUD authority state

`BattleHud` exposes separate stable stores for the full HUD, combat panel, minimap,
reload bar and battle-info opacity. `getCombatSnapshot`/`subscribeCombat` and
`getMinimapSnapshot`/`subscribeMinimap` are arrow-defined `useSyncExternalStore`
methods; each store publishes a new object identity only after its contract fields
change. Movement coordinates participate in the minimap store only, so ordinary
movement does not republish the full HUD.

## Combat projection

`HudCombatSnapshot` is rebuilt from the ordinary server-confirmed
`MsgRoomSnapshot`. It carries only present values:

- `visible` requires PLAYING/FINISHED and a local player; `playerId` and `alive` follow the local `PlayerSnapshot`.
- `serverTime`, `selectedAmmoSlot`, `ammoItemId`, `ammoMagazine`, `ammoSlots` and
  `reload` copy the server snapshot. A missing selected slot or magazine is left
  absent rather than inferred.
- `reload` is exposed only while the local player is alive in `PLAYING`.
- `canUseShortcuts` requires a living local player in `PLAYING` without autopilot. Mouse slot actions use the existing `BattleInput.send(slot)` path; its map-loading, connection, phase and autopilot gates remain authoritative for sending.
- `activeEffects` maps the confirmed skill4/5/6/7/8/9/10/11 expiry records to
  `{skillId, expiresAt}` and is empty outside `PLAYING` or after death. Those
  expiries express current validity only; they do not authorize a new cast or a
  client-side cooldown.

## Minimap projection

`HudMinimapSnapshot` uses the snapshot's original world `x`/`z`; projection to
the top-down scene image uses the same per-map fixed bounds as the UI markers. `BattleHud.setMinimapImage` retains only the matching map image and `clear()` removes it. The 25 source NAV/RPT mappings are recorded in `hud-minimap-coordinate-source.md`. Player `yaw` uses `bodyYaw` when
present, otherwise the movement `yaw`. The minimap filters actors through the
existing `isHiddenByOpticalCamouflage` rule, so an effective enemy skill9 optical
camouflage hides an actor where the observer rule applies. `roleDisguise` does
not hide identity. Objectives are copied directly from `match.objectives`.

## Five-mode info

The team-life, conquest-score, VIP-HP and remaining-objective definitions are user-confirmed project rules; `battle-hud-confirmed-rules.md` records their scope. Melee projects the confirmed `catsInfo + dogsInfo` sum: the server counts the local player's kills of cat-side and dog-side tanks separately, freezes them in the result and clears them each round. This is the adopted rule in `battle-equipment-exit-melee-rules.md`; the original DogsInfo producer remains a source boundary.

`HudSnapshot.modeInfo` is present only in `PLAYING` or `FINISHED`; `teamCounts`
keeps the previous mode1 contract.

| Mode | Binding | Authority source |
| --- | --- | --- |
| 1 | `teamLives` | Existing `teamInfo` projection over `match.teamLives` |
| 2 | `teamScores` | Current `teamScores[0..1]` conquest score |
| 3 | `vipHp` | Current HP of each team's `isVIP` player |
| 4 | `catsInfo+dogsInfo` | Confirmed local side-specific kill counts, or frozen result counts in `FINISHED` |
| 5 | `destroyObjectivesRemaining` | Remaining live `DESTROY` objectives |

Invalid or absent authority fields leave `modeInfo` undefined; the projection
does not fill score-like zeroes. `WAITING`, room changes and new rounds clear the
old value through the normal snapshot projection.

## HUD player fields

`HudPlayer.isVIP` copies `PlayerSnapshot.isVIP`. `HudPlayer.title` copies the optional server-confirmed `PlayerSnapshot.title.name`.
The source title/VIP controls remain in the display tree. Occupied player slots
show title-table ID1 “嗷嗷待哺” when no nonempty title is available; a confirmed
title takes precedence. Empty player slots stay blank. This UI default does not
assign account ownership or selection.

## Portrait fire bridge

`BattleHud.event` accepts `beforeShot` by setting and recording a per-player
pending flag, then skips the duplicate `fire` reset when that paired event
arrives. A `fire` without `beforeShot` still resets the portrait normally.
The pending flag is removed on death, round/lifecycle changes and `clear()`.
