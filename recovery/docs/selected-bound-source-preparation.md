# Selected pet skill source

The playable binding is an explicit reconstruction: an ownership-validated selected MyPet record becomes the independent bound skill source at WAITING/start. It does not claim recovery of the original role+a0 assignment producer.

`apps/server/src/battle/roles/selected-bound-source.ts` exports:

```ts
freezeSelectedBoundSource(selected: OwnedRoleBaseRecord | undefined): OwnedRoleBaseRecord | undefined
```

The caller resolves and validates selected ownership. This module copies the name and all original fields into a separate record/map. All six base IDs at44..58 and ranks at5c..70 must exist; missing fields return undefined. An explicit zero rank remains zero. The module neither invents levels nor changes current16skill slots. Replacing or clearing a selection replaces or clears the source. Later mutation of the account-owned record does not alter a captured battle binding.

Existing readRoleSkillSources/selectRoleSkills remain the consumers. They use baseId+rank−1, source order and the original Trigger0/Func1/Tffff passive predicate. The legal saved Pet2 record selects10251 only from the six ranked entries; its other five entries are not installed as active skills. Source selection, limits, expiry-zero mastery decrement, tank-type selection and float32 movement conversion stay in their existing order.

The main task has integrated the module into WAITING binding, attribute computation and snapshot projection. `selected-bound-source-rules.json` confirms copy isolation, replacement, absence, missing-rank handling, explicit zero-rank preservation and Pet2's selected2001/10251 result without current-slot modification. The dedicated test and repository-compatible strict TypeScript command exit0. These are module conditions, not a multiplayer business acceptance.

## Formal integration

Main owns PlayerState, attributes, projection, owned-source binding and snapshot. Add an optional independent bound source, create it only after selected ownership validation, and use that same source in all readRoleSkillSources calls. WAITING reselect replaces the source; start freezes it; Leave clears it. Recompute attributes through the existing unified life/movement/armor/ammo consumers. The optional snapshot roleSkillSources exposes currentSkillIds, six equipmentSkills baseId/rank pairs and selectedSkillIds. The dedicated ordinary runner compares this projection at WAITING, start and after movement; complete players are compared between both clients.

## First ordinary network contract

Use a lawful account checkpoint or ordinary BUY/SelectRole. Tank52 is a positive-price type2 tank; Pet2's passive10251 contributes MTankMastery1. Tank3 and4 are type1, so their movement cannot prove that medium-tank increment even when the passive is selected.

Before starting, obtain the actual purchased record fields and current production slot data. Derive the expected difference from the original existing formulas using those exact inputs, including owned+34 and expiry-zero decrement. Do not use unrelated historical account records as a same-role ownership combination.

The necessary first scope is selection→WAITING captured source→ordinary start→forward/back distance, A/D body angle and Arrow aim→same-tick dual attributes/source state→normal Leave. Preserve current16slots, independent source ranks, complete players and relevant events. Record simulated tick intervals, server time and wall time separately. No HP/position/flags injection, all-tank matrix, old ammo/death/FX/restart repeat or guessed active pet ability behavior is required.

## Limits

Original+a0 installation/ownership producer, active pet ability casting and level-growth rules remain unresolved. The formal module implements the selected-source binding reconstruction. It does not restore the original server producer or complete the21-tank goal.

The prepared ordinary driver uses `node scripts/start-server.mjs`, the genuine BUY52 response and selected Pet2 record from the lawful account checkpoint. Its Tank52 armor calculation is a source oracle only; the network scope observes skill sources and movement without adding armor wire fields or claiming damage. The coordinated compiled release was exercised once on port3602: dedicated types session6487 and actual session44291 both exited0; the server was stopped and the port observed empty.


## Ordinary purchased representative

`selected-pet-bound-network-2026-10-05T18-41-53-859Z.json` records a lawful checkpoint account buying Tank52 through TankShop and selecting its owned instance with Pet2. WAITING, start and final skill snapshots contain the unchanged current16 slots (2001/4020 plus zeros), six original base/rank pairs and selected2001/4020/10251. Only10251 is selected from Pet2's six entries.

The same newly purchased Tank52 record supplies owned+34=0 and the medium-tank inputs. Bound speed100 and turn0.7504915595 differ from the unbound formula90/0.6806783676. Ordinary forward and reverse each cover24.99960 units over0.25 simulated seconds, with opposite signed directions. Body and independent turret windows each rotate0.1876 radians over0.25 simulated seconds; the turret window leaves body angle unchanged. Server and wall durations are separately stored in the raw.

All30 common snapshot keys have identical complete players between both clients. No fire is requested; HP stays unchanged. Both normal round1 Leave replies succeed and cleanup completes. The wrapper is `selected-pet-bound-network-accepted.json`; independent main review is accepted in `selected-pet-bound-root-review.json` with status `PASS_FINITE_SELECTED_PET_PASSIVE_BINDING_MEDIUM_MOVEMENT_DUAL_STATE_LEAVE_SCOPE`. Armor source composition is recorded only as a formula oracle, without a network armor or damage claim.
