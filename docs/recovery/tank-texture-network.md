# Tank texture network acceptance

`tests/tank-texture-network.cts` checks the rebuilt `TankTextures` API through actual TSRPC WebSocket connections to an isolated server on port3018. The server uses a temporary SQLite database. Four account tokens and imported native-layout role records are explicit test fixtures; fresh accounts receive no profile, tank, texture or balance grants.

Run from the repository root:

```sh
npx tsx tests/tank-texture-network.cts
```

A passing run writes `recovery/output/tank-texture-network.json` with the confirmed selections, balances and persisted owner state.

The test verifies:

- Authentication, empty-account and foreign-instance rejection, including the same tank instance ID owned independently by another account.
- Cross-component, cross-tank, unknown resource, recovered missing-source texture1510011 and rarity-zero selection rejection; insufficient tokens leave the complete profile and ownership records unchanged.
- A confirmed `U=21011,M=21012,XY=20013` selection costs110 tokens. Changing only U to21021 costs50 tokens. The source money balance remains2147483649.
- Confirmation updates only the selected record's U/M/XY fields and the profile token balance. Names, other record fields, unselected tanks, pets, unrelated profile bytes and profile strings retain their imported values.
- Unchanged and all-zero requests return result0 without charging. A successful selection returns result3 with the confirmed IDs and balances.
- In WAITING, a changed selection cancels readiness and updates the snapshots received by both room clients. Unchanged and rejected requests retain readiness. The observer's independent selection stays unchanged.
- Ordinary Ready requests start a match; a neutral PlayerInput travels through the real connection. A texture change in PLAYING is rejected without changing persistence or the selected snapshot.
- After the actual server stops and restarts, token authentication recovers the owner selection and balances, all other accounts retain their state, and a newly created room uses the persisted textures.

## Limitations

This is rebuilt server network acceptance. It does not establish original server purchase rules, rendered pixels, audio, or match outcomes. The recovered table has no selectable rarity1 rows, so the real catalog network path does not exercise a money-price purchase; the source money-cost branch is covered by the focused account-store test. Match setup uses normal room, CPU and Ready APIs without position, HP, clock or finish injection.
