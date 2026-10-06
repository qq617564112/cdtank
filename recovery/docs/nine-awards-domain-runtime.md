# Nine-award domain runtime

`apps/server/src/config.ts` projects the nine original award columns from every verified `m001..m005` row into `ModeMapConfig.awards`. The projection retains each row's enable and score literal, plus Savage, Console, Kind and Crafty Damage/DamagePlus. It does not cap values, build a second scoring table, or change existing title, tank or mode behavior.

`apps/server/src/settlement/awards.ts` owns `computeRoundAwards(map, participants)` and the settlement-facing alias `settleAwards`. The module is pure: inputs are the real `ModeMapConfig` and frozen participant data (`playerId`, `team`, `playedSeconds`, `roundStats`, kills, deaths, objectives, pre-award combat score, outcome bonus and total score). It reads no World state and no database.

## Adopted rules

- Only participants with `playedSeconds > 0` are considered.
- Perfect: no deaths and at least one kill or objective.
- MVP: highest pre-award frozen total score, one per team in modes 1-3 and one overall in modes 4/5, with a positive kill/damage/objective contribution; ties compare kills, objectives and the smaller player id.
- Savage: enemy damage reaches the source threshold.
- Console: at least one death and damage taken reaches the source threshold.
- Brave: at least one death and at least one kill.
- Kind: real ally healing reaches the source threshold.
- Crafty: real rear damage reaches the source threshold.
- Shy: zero shots and real damage taken.
- Greedy: modes 4/5 only, highest positive damage; ties compare kills and the smaller player id.

The four threshold awards use the adopted unit policy:

```text
source Damage + source DamagePlus * max(0, enemy participant count - 1)
```

The enemy count is different-team for modes 1-3 and all other players for modes 4/5. `DamagePlus` is part of the rule; it is not ignored. Enable values other than 1 grant nothing.

Every award type is added at most once per player per round. All real awards remain in `ResultPlayer.awards`, up to nine. The result UI's five slots are a display limit and take the first five entries in source order: Perfect, MVP, Savage, Console, Brave, Kind, Crafty, Shy, Greedy.

## Integration boundary

The battle worker owns real `shots`, `hits`, `damage`, `damageTaken`, `killCombo`, `friendlyFireDamage`, `healing` and `rearDamage` production. It must call the pure scorer with pre-award scores, then add `awards[].score` to `combatScore` once without changing `outcomeBonus`.

The account worker owns persistence: it applies frozen statistics and awards inside the existing `BEGIN IMMEDIATE` history/reward transaction, skips CPU and spectators without an account identity, and reads only committed spending receipts for actual money/token totals. The UI consumes `ResultPlayer.awards` and `ResRoleProfile.statistics/awards`; missing historical data stays absent.

The battle, account and UI producers are integrated. The single concentrated static review is complete; be4ffce corrected real-fire `shots` ordering, the medical-ammo owner type, and `awards: []` for real participants while legacy rows without awards stay unknown. No unit test, browser, build, typecheck, lint, exporter, native, autovalidation or generated source was run. Live shots, healing, rear-damage, ledger, reconnect/restart, account-skip, original Windows comparison and page rendering therefore remain unverified.
