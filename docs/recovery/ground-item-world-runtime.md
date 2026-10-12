# Ground item World production bridge

`World` consumes the committed ground-item domain and account transaction contracts
without adding a second entity store or shared schema field. The room's existing
`groundItems` projection and optional `groundItemDropped`/`groundItemPickedUp`/
`groundItemRemoved` events remain the sole wire surface.

## Typed callbacks

```ts
interface AcquireDiscardCallbacks {
  acquire?: (request: AcquireGroundItemRequest) =>
    {record: InventoryWireRecord; refreshPlayerIds?: readonly string[]} | undefined;
  discard?: (request: DiscardGroundItemRequest) => InventoryWireRecord | undefined;
  roundUse?: (playerId: string, itemTableId: number) => number;
}
```

`index.ts` injects `AccountStore.acquireOwnedItem`, `AccountStore.discardOwnedItem`,
and the existing `consumeAccountBattleItem` callback. The acquire request supplies
the server-resolved `roomId`, `round`, `groundId`, item and quantity; the account
adapter maps the domain's `expectedQuantity` to its `expectedOwned` CAS argument.
No client account ID is accepted.

The acquire transaction is the authority for the returned canonical
`InventoryWireRecord`. World applies only that committed record through the minimal
`reconcileGroundItemInventory` helper. It updates the same instance, clears a removed
hotkey when the record reaches zero, and does not replace the full `RoleCombatState`
or reset already spent battle quantity.

For discard, the domain supplies one exact `instanceId`, `itemTableId`, and
`expectedQuantity`. The account adapter commits one unit or rejects the CAS. A
`{deleted: true}` receipt becomes a same-instance local record with
`ownedQuantity = 0`, so the domain's normal hotkey cleanup runs. A `{deleted: false,
remaining}` receipt uses the committed remaining record. Failed or thrown writes
leave the entity and local inventory unchanged.

## Action 100

The ordinary `PlayerAction` path validates the authenticated session's room and
round before World is called. World then requires:

- a real participant with a resolved non-CPU account;
- `PLAYING`, matching `roomId` and `round`, reached intro, and no autopilot;
- a strictly increasing ordinary action sequence;
- `action=100` and a positive uint32 `value`;
- `value` equal to an instance currently present in the seven configured hotkeys.

Only then does `discardToGround` check the exact owned inventory instance, category,
visual, and positive owned/battle quantity. One successful action drops quantity 1.
The client's selected hotkey instance is used directly; no new selection field or
action 1/2 path is introduced. The action request itself does not consume or use the
item.

## Battle quota

World increments a per-player, per-item round-use counter only after
`confirmBattleItemConsumption` accepts a real consume callback. This includes
ordinary item use, special ammo, and ground-trap placement because they all pass
through the same World callback.

The counter resets on a new round and on leave. A committed pickup or connection
refresh recomputes an assigned stack as:

```text
max(0, min(ownedQuantity, max(0, BattleUseMax - roundUse)))
```

`ownedQuantity` already reflects real consumption, so `roundUse` bounds the
remaining spendable amount instead of being subtracted from the owned count a
second time. An unassigned instance stays at zero battle quantity.

A real pickup fills the first empty slot in the correct local band for a newly
unassigned instance: Battle2..4 for weapons/traps, Battle5..8 for
consumables/treasures. It never overwrites a full slot, auto-uses, or auto-switches
weapons; a full bar still banks the item but leaves no usable slot. Only the
current-round character hotkeys change (visible to the Inventory RPC/HUD); the saved
account configuration is untouched. An existing assigned stack follows the
`remainingBattleQuantity`/`roundUse` remainder, so a pickup never restores quantity
already spent in the round. Cross-connection reconciliation never auto-fills a slot.
Discard is not a use: it reduces owned quantity without increasing `roundUse`.

## Same-account inventory notification

After a committed real ground-inventory write (a pickup acquire or a discard),
`syncGroundItemRecord` records each live human participant of the same account,
across every room, and World emits one ordinary `MsgRoomEvent` with
`type='inventoryChanged'` per participant. The `roomId`, `playerId`, and
`targetId` fields carry that participant's room and id; the remaining required
fields are `0`/`''`. The event never carries account identity. A client consumes
it by re-querying its own Inventory RPC and republishing discard candidates; no
new RPC or snapshot field is introduced.

The notification is produced only when a real ground-inventory change commits.
CPU grants do not notify, and there is no per-tick or receipt-only polling. In
the action path `drainInventoryChanged` runs after the write commits; in the tick
path it runs after every room snapshot is queued, so the committed notice still
travels alongside the same-tick finish snapshot.

## Event and lifecycle ordering

`advanceGroundItems` runs after actor movement and before projectile processing. It
first removes every ground entity whose `createdAt` is 30 seconds old or older against
the server clock, then scans `PLAYING`, alive, status2 participants in the same room at
XYZ distance `<= 40`; a successful pickup removes the entity and emits pickup/removal
events. Every ground entity, `DISCARD` included, uses this 30 second lifetime; the
adopted values come from `shared/content/definitions/index.json` `rules.groundDrops`,
and the original `VanishTime` meaning stays unconfirmed.

Every real placement destruction rolls once, deduplicated by
`placement + destroyedAt`, across all five modes. Modes 1-4 use the current map's
original Breach placements as destructible `sceneObjects` (mode2 included); mode5 uses
its single Breach `objectives` entity. The unified roll uses the former mode5 50% chance
and maps a success onto the `runtime.values.breachDropOrder` pool
`[1, 2, 2010, 20001, 20002]`, one unit each. Castle keeps its original mode1/mode2 rule;
Castle, Plant, and Crush never enter this producer, and mode5 still produces the drop
before the end-of-round objective check. A later genuine respawn creates a new
destruction timestamp, so it can roll again while the old timestamp cannot replay a
removed or already-rolled drop.

A real pickup of item20001/item20002 requires the selected pet JSON type: cat
`petType 1` for 20001, dog `petType 2` for 20002. A wrong or unselected pet leaves the
entity in place, and other items are unrestricted. The committed pickup adds one to
owned inventory and heals the actual picker 15 through the health entry clamped to the
mode's current `maxHp`; a full-health player still receives the item, `lastStand` does
not heal, and a failure neither heals nor removes the entity. Other connections of the
same account refresh inventory only. The pickup healing of 15 stays separate from the
manual `ItemSkill2=30005` self-use of 30.

For room deletion, finish, and new-round loading, World clears the room's ground
entities and the domain's per-round counter/trigger state. Leave clears only that
player's round-use bookkeeping; it does not refund inventory or remove other
players' ground entities. The whole room clear owns that cleanup.

## Limitations

No tests, browser run, build, typecheck, lint, native export, generator, evidence run,
or byte comparison was performed. This document records source wiring and protocol
contracts, not measured multiplayer, persistence, or browser acceptance.
