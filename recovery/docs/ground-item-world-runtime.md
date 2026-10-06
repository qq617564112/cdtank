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
max(0, min(ownedQuantity, BattleUseMax) - roundUse)
```

An unassigned new instance becomes available but is not automatically selected into
a hotkey. This keeps a pickup from restoring quantity already spent in the round.
Discard is not a use: it reduces owned quantity without increasing `roundUse`.

## Event and lifecycle ordering

`advanceGroundItems` runs after actor movement and before projectile processing. It
only scans `PLAYING`, alive, status2 participants in the same room at XYZ distance
`<= 40`; a successful pickup removes the entity and emits pickup/removal events.

In mode5, a real Breach reaching 0 HP creates its one drop immediately after the
authoritative objective damage and before `objectiveEnd`/finish cleanup. Castle,
environment objects, and other modes never enter that producer. A later genuine
respawn creates a new destruction timestamp, so it can roll again while the old
timestamp cannot replay a removed or already-rolled drop.

For room deletion, finish, and new-round loading, World clears the room's ground
entities and the domain's per-round counter/trigger state. Leave clears only that
player's round-use bookkeeping; it does not refund inventory or remove other
players' ground entities. The whole room clear owns that cleanup.

## Limitations

No tests, browser run, build, typecheck, lint, native export, generator, evidence run,
or byte comparison was performed. This document records source wiring and protocol
contracts, not measured multiplayer, persistence, or browser acceptance.
