# Round statistics and battle settlement runtime

`apps/server/src/battle/round-statistics.ts` owns the per-participant counters, and the real battle path fills them. `PlayerState.roundStats` is created by `createBattlePlayer` and reset on every first start and consensus rematch by `initializeBattleParticipants`, so a later round cannot leak counters from an earlier one.

## Source facts

- `MsgRoomSnapshot` exports `RoundStats{shots,hits,damage,damageTaken,killCombo,friendlyFireDamage,healing,rearDamage}`, `RoundAward{type,score}` and the `ResultPlayer.roundStats/awards` fields (shared contract, adapted on main).
- `fireProjectile` emits the `fire` event and resolves the accepted query boundary; the deferred `pendingShot` in `advanceActors` is the rebuild of the original 0.4s 03 start/query delay.
- `consumeConfirmedAmmo` is the rebuild of the persisted inventory compare-and-swap gate; a rejected reservation never reaches `fireProjectile`. `setStatus` clears `pendingShot`, so a cancelled pending shot never fires.
- `damagePlayer` applies the qualified armor/critical chain and reduces real role HP; `damagePlayerDirectly` is the direct-skill branch used by burn, airstrike and traps.
- `resolveShotDefenseFacet(bodyYaw,bearing)` already classifies `FRONT|SIDE|BACK` from the real incoming bearing, and `resolveMedicalAmmo` restores real role HP along the 2009/4007 chain.

## Adopted rules

- `shots`: one per accepted, actually fired shot. The counter increments in `afterFire`, so CAS rejection and a cancelled `pendingShot` add nothing. Func22/23 change the shot modifiers but do not fire a second shot. A shot that is fired but then blocked by `consumeShotCancellation` still counts as a shot.
- `hits`: at most one per shot identity, only when an ordinary ammunition shot reduces a hostile role's real HP. The shot identity is the fired shot id for the immediate 2001/penetrating branch and the unique `BulletState.id` for the travelling branch. Burn, airstrike and trap damage never carry a shot identity, so they cannot fabricate a hit.
- `damage`: real hostile role HP reduction, clamped at 0, including burn/airstrike/trap and excluding scene HP.
- `damageTaken`: real hostile HP reduction on the target. Hostility uses `mode<=3` team identity and modes 4/5 as individual, so equal team numbers in modes 4/5 are not allies.
- `friendlyFireDamage`: real HP reduction caused by a team-mode ally that was allowed to hurt (friendly fire on). A blocked or refused friendly hit reduces no HP and adds nothing.
- `healing`: real restoration of a non-self ally, clamped to max HP. Modes 1-3 treat the same team as allies; modes 4/5 have no allies, so medical shots there heal but do not build Kind.
- `rearDamage`: the hostile HP reduction whose existing `resolveShotDefenseFacet` classification is `BACK`.
- `killCombo`: the largest real enemy-kill streak while the attacker has not died. A real death resets the current streak and a new round resets both current and maximum.

## Settlement

`finishRound` first freezes the pre-award `MatchResult` (with the deep-cloned `roundStats`), then computes `computeRoundAwards(map, participants)` over every real participant with a `roundStats` producer, including mid-round departures with their frozen `playedSeconds`. Each player's award scores are summed once into `combatScore` and `totalScore`; `outcomeBonus` is untouched and MVP is resolved before any award score is added. All real awards stay in `ResultPlayer.awards`; the result UI's five slots are only a display limit.

Mid-round ordinary leavers are frozen in `captureDeparted` with a deep-cloned `roundStats` and their real `playedSeconds`. The freeze passed to `onMatchCommitted` deep-copies `roundStats` and `awards` so later rounds cannot mutate an already-frozen result.

## Unverified

No unit test, browser, build, typecheck, lint, exporter, native or autovalidation ran for this batch. Live network play across all five modes, HD rendering and restart/reconnect continuation of statistics remain unverified.
