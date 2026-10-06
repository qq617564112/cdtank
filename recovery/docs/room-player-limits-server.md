# Room player limits

The recovered `recovery/output/verified/assets/data/Data/ui/layouts/createroom.xml` defines four adjustment buttons (`btnDecLowBound`, `btnIncLowBound`, `btnDecHighBound`, `btnIncHighBound`) and two value labels (`txtLowBound`, `txtHighBound`), at lines 364, 376, 388, 400, 467 and 483. The 26 recovered mode/map rows in `recovery/output/verified/tables/m001.json` through `m005.json` provide `PlayerMin` and `PlayerMax`; all source minima are at least one.

The rebuilt policy accepts integer settings satisfying `sourceMinPlayers <= minPlayers <= maxPlayers <= map.maxPlayers`. Original widgets and map values are source evidence; this validation inequality is a reconstructed server policy.

`rooms/player-limits.ts` selects and validates limits before room allocation. Omitted request fields select the map defaults. Each room stores its own limits; the shared map directory remains unchanged. Creation retries compare normalized limits, so explicitly specifying defaults and omitting defaults reuse the same room, while changing either setting rejects the retry.

The configured maximum controls human admission, CPU admission, quick-match selection and team capacity. Team capacity retains `ceil(maxPlayers / 2)`. Start and rematch thresholds use the configured minimum, with the existing `World.options.minPlayers` override taking precedence. Existing team-presence, ready-vote and CPU-vote rules remain the lifecycle policy.

`CreateRoom` adds optional `minPlayers` and `maxPlayers`. `RoomSummary` adds optional `minPlayers` and reports the configured `maxPlayers`. `MatchSnapshot` adds optional `maxPlayers` alongside its effective `minPlayers`. The generated protocol retains the existing API/message service IDs.

Verification:

- `npx tsx tests/room-player-limits.cts`: two ready humans stay waiting at 3/3; adding the third CPU and renewing human readiness starts the room. Human and CPU capacity rejection, odd team capacity, quick-match selection, two simulated ordinary time-limit rounds and rematch, normalized defaults/retries, seven invalid numeric or bound combinations, source-map immutability and the existing minimum override pass.
- `npx tsx tests/room-player-limits-network.cts`: an isolated TCP/WebSocket server on port 3178 authenticates four accounts, joins three, rejects the fourth at configured capacity, keeps two ready humans waiting and starts with the third ready vote. Directory and all three snapshots report 3/3. Four invalid wire requests leave no rooms; identical creation retries reuse membership and changed settings reject.
- `npx tsc --noEmit`: application and test type contracts pass.

Machine-readable results are `recovery/output/room-player-limits.json` and `recovery/output/room-player-limits-network.json`.

## Limitations

Original server-side bound validation is unresolved. The implemented inequality and existing ready/rematch lifecycle are rebuilt policies; the recovered XML establishes the controls, and recovered map rows establish their source bounds.
