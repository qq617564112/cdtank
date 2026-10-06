# M5-02-N browser acceptance

`tests/browser-room-player-limits.mjs` drives the normal lobby through dedicated server **3179**, Vite **5218**, and Chromium CDP **9288**. It uses native CDP controls and decodes websocket frames; no server or gameplay state is injected.

The acceptance covers source-derived min/max defaults and map info, reset on mode/map changes, invalid min > max refusal without a `CreateRoom` request, custom 3–3 room creation and authoritative summaries, two real peers ready below the minimum remaining `WAITING`, owner CPU fill and full-room rejection, stale-directory join rejection, transition to `PLAYING`, and native movement. It captures 1080p and 4K controls plus waiting/playing/rejection evidence under `recovery/output/browser-room-player-limits*`.

Run with:

```sh
node --import tsx tests/browser-room-player-limits.mjs
```

Result: **PASS**. The saved JSON contains authoritative creation, room-directory, readiness, CPU and stale-join responses plus movement evidence. All dedicated processes exited, Vite closed, and the temporary account database and Chromium profile were removed.
