# Room friendly fire

`CreateRoom.friendlyFire` selects per-room team damage. Omission and explicit `false` share the same normalized creation key. Modes 1–3 accept `true`; modes 4–5 reject it before allocating a room. Non-boolean values reject. Existing minimum/maximum argument positions are retained, with the optional flag appended to `World.createAndJoin`.

`RoomSummary.friendlyFire` and `MatchSnapshot.friendlyFire` are additive optional wire fields. The server projects the authoritative boolean in waiting, play, finish and rematch snapshots. The setting belongs to the room and does not modify recovered map definitions. Creation retries compare the normalized flag, so a changed flag rejects instead of changing an existing room.

With friendly fire off, a teammate projectile collision preserves HP and applies the existing `BrokenScore` penalty and zero-value `friendlyFire` event. With it on, the ordinary immunity and defense rules apply. An immune hit emits `immuneHit` without damage or penalty. Each nonimmune hit applies `BrokenScore` once and emits `friendlyFire` and `hit` with the actual mitigated damage. Friendly casualties use the ordinary HP record, dead status, death count, respawn deadline and revival path. Teammate hits and destruction award no positive hit/destroy points, attacker kills or team score. Opponent combat retains the existing rewards and counters.

In mode 1 a friendly casualty consumes the victim team's life. Exhausting that team's lives awards victory to the opposing team. In mode 3 destroying a friendly VIP awards victory to the opposing team. Mode 2 retains its capture victory rules. CPU target selection and avoidance of friendly firing lines continue unchanged.

The recovered `recovery/output/verified/assets/data/Data/ui/layouts/createroom.xml` contains `rdoFriendlyFireOff` and `rdoFriendlyFireOn`. Those controls establish the toggle's existence. Eligibility, default behavior, damage authority, immunity/defense interaction, score policy and casualty victory rules above are explicitly reconstructed server policy. The recovered map `BrokenScore` supplies the existing penalty value; the XML does not establish original server scoring or qualification semantics.

Verification:

- `npx tsx tests/friendly-fire.cts` verifies explicit reconstructed rule fixtures: off-state legacy penalty, on-state immunity/defense, damage values, HP/status/death/deadline, no friendly positive rewards, depleted team and friendly VIP outcomes, and retained opponent rewards.
- `npx tsx tests/friendly-fire-world.cts` creates each off/on room through ordinary join/changeTeam/ready with two teammates and an opposing human. Ordinary movement and snapshot-derived aim/fire produce real teammate projectile collisions. Off preserves HP; on produces natural friendly death and respawn. Penalty counts, zero attacker kills/team scores and consumed team life agree. Default normalization, changed-config rejection, unsupported modes and invalid type validation pass.
- `npx tsx tests/friendly-fire-network.cts` runs the real server on port 3180 with three authenticated connections per room. Ordinary APIs create teammates and an opponent; snapshots supply the target direction for ordinary `PlayerInput` aim/fire. Off preserves HP and on reduces it, with actual fire/friendlyFire/hit events and penalty-only scoring. All connections receive the same flag. Defaults, normalized retries, changed-flag rejection, unsupported modes and malformed boolean requests pass.
- `npx tsc --noEmit` verifies application and test contracts.

Results are `recovery/output/friendly-fire-rules.json`, `friendly-fire-world.json` and `friendly-fire-network.json`.

## Limitations

Original server-side friendly-fire rules remain unresolved. Room state is temporary and does not persist across server restarts. The focused life fixtures test reconstructed policy; they are not original binary oracle evidence.
