# Respawn protection runtime

## Current domain API

`apps/server/src/battle/respawn-protection.ts` owns the adopted source30001 real-respawn
policy:

```ts
interface RespawnProtectionState {
  skillId: 30001;
  expiresAt: number;
}

applyRespawnProtection(roomId: string, player: RespawnProtectionParticipant,
  now: number, events: MsgRoomEvent[]): boolean;
clearRespawnProtection(player: RespawnProtectionParticipant): void;
advanceRespawnProtection(roomId: string, player: RespawnProtectionParticipant,
  now: number, events: MsgRoomEvent[]): boolean;
```

`applyRespawnProtection` accepts only an alive status2 player with no existing
`respawnProtection`. It writes `{skillId: 30001, expiresAt: now + 5000}` using the
authoritative clock and emits one `respawnProtectionStarted` play notification:
skill30001, effectIndex0, duration5, and the player's numeric role ID. Repeated calls
for the same life return false and do not refresh the deadline. The first spawn does
not call this API.

`advanceRespawnProtection` clears the state at the authoritative deadline and emits
one `respawnProtectionEnded` event without a stop-effect message. `clearRespawnProtection`
is the lifecycle cleanup helper for death, finish, round reset, and Leave; it never
emits the natural-expiry event.

`apps/server/src/battle/items/invincibility.ts` also owns the shared damage predicate:

```ts
isBattleInvincible(player: BattleInvincibilityParticipant, now: number): boolean;
```

It reads `invincibility.expiresAt` and `respawnProtection.expiresAt` independently.
Either strictly future timestamp blocks damage. It does not read a pose or client clock.
Item8 keeps its existing inventory CAS, skill8 slot, consume path, and independent
`invincibility` state.

`apps/server/src/battle/life.ts` wires this predicate into both damage entry points.
`damagePlayer` (shot and burn/DOT path) and `damagePlayerDirectly` (direct trap and
airstrike path) call `isBattleInvincible(target, now)` and return one zero-damage
`immuneHit` event with no hit, damage, or reward accounting when either timer is
active. The event `skillId` reports the active source: item8 when its deadline is
strictly future, otherwise `30001`. Friendly-fire and shot-cancellation checks and
the original critical, defense, and death settlement order are unchanged. No
per-item second gate is added.

`finalizePlayerDeath` and `respawnPlayer` call `clearRespawnProtection` so no state
survives into the next life. Neither path grants protection; the first spawn does
not receive it, and this module never applies it automatically.

`PlayerState.respawnProtection` is optional and is not initialized by the constructor.
The snapshot schema (`version 106`) and room projection already carry the optional
`respawnProtection` field through `playerSnapshot`. No inventory, account,
role-source, current-skill-slot, or protocol-generator change is part of this domain
module.

## World lifecycle bridge

`World.simulateRoom` advances respawn protection for every participant before that
tick's last-stand death, direct-damage, burn, actor, and projectile work. A natural
expiry therefore cannot protect a later hit in the same tick.

The real `advanceActors` respawn callback clears stale state, completes
`respawnPlayer` with restored status2/alive/full HP, recomputes attributes, and then
calls `applyRespawnProtection` once. The initial room spawn and all other spawn paths
do not grant it.

`clearRespawnProtection` runs on death commit and Leave. `finishRoom` clears every
participant, and `beginRoomLoading` clears state before the next round starts. Death
also clears through the life-domain `finalizePlayerDeath`; the World calls are the
extra lifecycle boundary for Leave, finish, and round loading.

The original measured acceptance evidence has not been run; this document records
the implemented production bridge and its boundaries. It does not claim a measured
five-second network or browser run.

The source30001 second slot Effect37 is not redefined here. No extra HP restore,
transparency, attack clearing, sound, composite-skill rewrite, or source ownership
grant is introduced by this module.
