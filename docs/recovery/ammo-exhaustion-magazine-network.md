# Special-ammunition exhaustion preserves the ordinary magazine

Two authenticated connections complete the rebuilt finite-ammunition rejection workflow without refilling the ordinary2001 magazine. Exhausting owned2007 returns selection to2001 at5/6, rejects the held firing input, and permits a fresh ordinary input to consume the next round to4/6.

The fixture uses complete owned pet1/tank1 records, map7/mode4, HP600, no parts and a single owned2007 instance77 assigned to hotkey2 through normal Kitbag. Match actions use ordinary PlayerInput; no pose, HP, damage, hit, event or result is injected. This verifies the rebuilt server authority workflow, not recovery of the original server producer.

| Step | Selected ammunition | Public magazine | Observed result |
|---|---:|---:|---|
| First ordinary shot, then stop | 2001 | 5/6 | One ordinary fire |
| Select and fire the single special round | 2007 | 0/4 | ammoConsumed value0; live ammoSlots quantity0 |
| Held fire reaches the special reload deadline | 2001 | 5/6 | One itemRejected for2007; no gifted ordinary refill |
| Continue without fresh input for40 ticks | 2001 | 5/6 | Total fire count remains2 |
| Fresh fire input, then stop | 2001 | 4/6 | Third fire uses2001 |

Persistent inventory instance77 has ownedQuantity0. Its database battleQuantity remains1 as the stored entry field; current battle stock is0 in the authoritative public ammoSlots snapshot. Special reload duration is6.900000095367432 s. The ordinary remaining count survives the special shot and subsequent rejection.

Both connections receive identical complete players arrays across215 common PLAYING room/tick snapshots. Their ordered relevant events are identical: fire2001, ammoConsumed2007, fire2007, itemRejected2007, fire2001. Both normal Leave API calls succeed; clients, server and temporary database are cleaned, and port3252 has no listener.

Evidence:

- Runner: `tests/ammo-exhaustion-magazine-network.cts`.
- PASS capture: `recovery/output/ammo-exhaustion-magazine-network-2026-10-04T14-55-53-868Z.json` and matching `.log`.
- Prior raw capture: `recovery/output/ammo-exhaustion-magazine-network-2026-10-04T14-55-02-248Z.json` and matching `.log`.
- Strict standalone TypeScript verification passes.

## Limitations

This acceptance covers one2007 exhaustion in one map7/mode4 round. Browser rendering, account restart and other modes are outside this workflow.
