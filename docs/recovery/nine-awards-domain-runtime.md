# Nine-award domain runtime

`apps/server/src/config.ts` projects the nine original award columns from every verified `m001..m005` row into `ModeMapConfig.awards`. The projection retains each row's enable and score literal, plus Savage, Console, Kind and Crafty Damage/DamagePlus. It does not cap values, build a second scoring table, or change existing title, tank or mode behavior.

`apps/server/src/settlement/awards.ts` owns `computeRoundAwards(map, participants)` and the settlement-facing alias `settleAwards`. The module is pure: inputs are the real `ModeMapConfig` and frozen participant data (`playerId`, `team`, `playedSeconds`, `roundStats`, kills, deaths, objectives, pre-award combat score, outcome bonus and total score). It reads no World state and no database.

## Competitive award policy

- Only participants with `playedSeconds > 0` and real round statistics are considered. CPU participants compete under the same rules.
- Each award selects at most one recipient across the round. A category with no qualified participant remains empty. A player may win several categories when their performances lead those categories.
- Perfect: no deaths and at least three kills/objectives combined; highest combined count wins, then enemy damage, kills and the smaller player id.
- MVP: highest pre-award frozen total score among participants whose frozen outcome is WIN and whose kills are greater than zero, at most one overall in every mode; ties compare kills, objectives and the smaller player id. Losing players, draws and zero-kill players are ineligible.
- Savage: highest enemy damage among participants who reach the source threshold; ties compare kills and the smaller player id.
- Console: at least three deaths, more deaths than kills, and enemy damage taken reaches the source threshold; highest damage taken wins, then deaths and the smaller player id.
- Brave: at least one death and a real kill streak of at least three; longest streak wins, then kills, fewer deaths and the smaller player id.
- Kind: modes 1-3 only, highest real ally healing among participants who reach the source threshold; ties compare fewer deaths and the smaller player id.
- Crafty: real rear damage reaches the source threshold and makes up at least half of enemy damage; highest rear damage wins, then enemy damage, kills and the smaller player id.
- Shy: zero shots, at least one death, and enemy damage taken reaches the Console threshold; highest damage taken wins, then deaths and the smaller player id.
- Greedy: modes 4/5 only, at least three kills and more kills than deaths; highest kills wins, then fewer deaths, objectives and the smaller player id. This category measures finishing kills separately from Savage's damage.

The four threshold awards use the adopted unit policy:

```text
source Damage + source DamagePlus * max(0, enemy participant count - 1)
```

The enemy count is different-team for modes 1-3 and all other players for modes 4/5. `DamagePlus` is part of the rule; it is not ignored. Enable values other than 1 grant nothing.

The recipient limits and performance requirements are project business rules. The original tables supply enable values, threshold parameters and score literals; they do not establish the original server's selection algorithm. Thresholds make an achievement eligible, while the best eligible performance determines its recipient.

Every award type is added at most once per player per round. All selected awards remain in `ResultPlayer.awards`. The result UI's five slots are a display limit and take the first five entries in source order: Perfect, MVP, Savage, Console, Brave, Kind, Crafty, Shy, Greedy. Source scores include Kind 0, Crafty -25 and Shy -50. Stored results and account counts retain their committed awards; future round settlements use this policy.

## Integration boundary

The battle worker owns real `shots`, `hits`, `damage`, `damageTaken`, `killCombo`, `friendlyFireDamage`, `healing` and `rearDamage` production. It must call the pure scorer with pre-award scores, then add `awards[].score` to `combatScore` once without changing `outcomeBonus`.

The account worker owns persistence: it applies frozen statistics and awards inside the existing `BEGIN IMMEDIATE` history/reward transaction, skips CPU and spectators without an account identity, and reads only committed spending receipts for actual money/token totals. The UI consumes `ResultPlayer.awards` and `ResRoleProfile.statistics/awards`; missing historical data stays absent.

## Verification limits

The battle, account and UI producers are integrated. Award selection has been inspected statically. No unit test, browser, build, typecheck, lint, exporter, native, autovalidation or generated source was run for this policy. Live competition, tie resolution, healing, rear damage, account persistence, reconnect/restart and page rendering remain unverified. Existing evidence does not validate this policy or establish the original server rules.
