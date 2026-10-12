# Active room reconnection

A temporary transport loss preserves the authenticated participant in the existing PLAYING room for thirty seconds. The world clock continues. Disconnect releases movement, turn, aim, fire and item input, and disables voluntary autopilot. Other participants still see the same role, life, inventory, skills and room state.

This is a Web reconstruction. The original service's reconnect, grace and interruption rules remain unresolved.

## Identity and state

The server retains the old connection's account and room binding so ordinary settlement can still identify the participant. Re-authentication with that account atomically replaces its connection identity, including the room creator identity, while retaining the existing PlayerState. Account records are not rebound and preparation is not rerun.

ResumeRoom checks the authenticated room/player membership and returns the current authoritative snapshot and last accepted manual input sequence. It cannot join a different participant or bypass PLAYING admission. Expiry uses the existing world.leave outcome, event, room and collision cleanup before removing account bindings. An explicit Leave removes membership immediately and does not create a reservation.

The formal browser retains its current scene, presentation owners and room feed during recovery. Its input cadence stops, keys clear, and successful recovery resumes above the accepted server input sequence. Current snapshots reconcile normal round and state transitions. A failed or expired recovery returns to the lobby. Transient events missed during transport loss are not replayed.

## Verification

`room-reconnect-network-2026-10-05T18-50-37-653Z.json` passes four authenticated ordinary participants on Map02 mode1 using a lawful saved purchase checkpoint. Ordinary movement and repeated firing stop after disconnect. Same-account recovery keeps role identity, position, life, skill sources and account records; sequence7 resumes with8 and ordinary movement works. Wrong-account and wrong-room requests are rejected. A different participant stays disconnected for the real thirty-second window, is removed, and cannot resume. Normal Leave clears the remaining room. The actual runner exits0 and port3603 is empty.

The formal browser validation covers ordinary Create/Join/Ready and input, a real WebSocket close under a short offline interval, automatic same-room recovery, retained Map02 owners, resumed input, dual complete state and normal Leave. The compiled browser session70569 exits0: `browser-map02-active-reconnect-2026-10-05T18-55-30-389Z.json`. The local input timer stops while the scene stays active; re-authentication restores the same room, participant and round. Both scenes keep their existing preview, twenty-nine plant owners, two water containers and four background voice/audio references without reloading. New ordinary W input moves the recovered role. Twenty-six pre-Leave common complete states agree. Both normal Leave operations clear player, plant, water, effect and voice owners and pause all old background audio. Server, Vite and CDP ports are empty. Root review: `room-reconnect-root-review.json`.

## Limitations

The grace period and automatic reconnect are reconstructed policies. Process restart discards temporary rooms. This scope does not recover original interruption rules, replay missed transient events, prove original GPU equivalence or close the complete restoration goal.
