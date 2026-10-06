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

`PlayerState.respawnProtection` is optional and is not initialized by the constructor.
No inventory, account, role-source, current-skill-slot, or protocol-generator change is
part of this domain module.

## Pending runtime wiring

The World/life bridge has not called these APIs yet:

- After a real `respawnPlayer` completes and status2/alive health is restored, call
  `applyRespawnProtection` once. Do not use it for the initial spawn.
- Advance the timer from the authoritative room tick.
- On death, finish, round reset, and Leave, call `clearRespawnProtection` so no state
  reaches the next life.
- Replace direct `invincibility` checks in direct, shot, trap, airstrike, and periodic
  damage paths with `isBattleInvincible(player, now)`.
- Project the optional state through the shared typed snapshot worker. This document
  does not claim that runtime bridge or snapshot projection is implemented.

The source30001 second slot Effect37 is not redefined here. No extra HP restore,
transparency, attack clearing, sound, composite-skill rewrite, or source ownership
grant is introduced by this module.
