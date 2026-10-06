# Stationary steering browser acceptance

The new rebuilt stationary A/D mapping rotates the tank body and movement-look angle together at the recovered turn rate. ArrowLeft/ArrowRight independently rotate turret aim. Two authenticated production browser pages receive identical poses during PLAYING.

`tests/browser-tank-numeric.mjs --steering-only` uses ordinary map7/mode4 CreateRoom/Join/Ready, owned pet1/tank1 records and real Chromium A/D/Arrow events. No position, combat or snapshot injection occurs. This is acceptance of the new rebuilt mapping, not a claim that this mapping was the original keyboard convention.

Source tank/pet mastery, combatLimits15 and f32 movement-turn scale produce0.6806783676147461 rad/s. Measurements use fixed50ms server tick differences within continuous nonzero rotation windows; neutral input-transition boundary frames remain in raw evidence.

| Key | Duration | bodyYaw change | yaw change | aim change | Rate magnitude | Absolute rate error |
|---|---:|---:|---:|---:|---:|---:|
| A | .4s | +.2723 | +.2723 | 0 | .680750 | .0000716 |
| D | .4s | −.2722 | −.2722 | 0 | .680500 | .0001784 |
| ArrowLeft | .4s | 0 | 0 | +.2723 | .680750 | .0000716 |
| ArrowRight | .4s | 0 | 0 | −.2723 | .680750 | .0000716 |

All four segments have zero horizontal displacement. Complete players arrays agree across101 common PLAYING snapshots matched by roomId/round/tick/phase. Ordinary forward/reverse, firing, magazine and switch evidence remains in `tank-numeric-network-browser.md`; those checks were not rerun.

Evidence:

- Accepted controls index: `recovery/output/browser-tank-steering-2026-10-04T14-48-27-053Z-analysis.json` (`CONTROLS_ACCEPTED`, full run `FAIL`).
- Unmodified raw capture/log: `recovery/output/browser-tank-steering-2026-10-04T14-48-27-053Z.json` and `.log`.
- Actual body screenshot: `recovery/output/browser-tank-steering-2026-10-04T14-48-27-053Z-body-after-A.png`.
- Battle screenshot: `recovery/output/browser-tank-steering-2026-10-04T14-48-27-053Z-battle.png`.
- First capture and bounded D-only analysis: `browser-tank-steering-2026-10-04T14-46-26-426Z.json` and `-D-analysis.json`.

## Limitations

Peer normal Leave succeeded. Host had returned to WAITING, where the native close entry is `[data-waiting-close]` in `apps/web/src/interface/lobby/waiting-room.tsx`; host normal Leave was not executed. The runner now selects that entry in WAITING and the existing summary/Leave entry in PLAYING, without another runtime. Both page contexts, browser/server processes and temporary data were cleaned; ports3251,5411 and9611 have no listener. This acceptance establishes the stationary steering controls and synchronization, not a complete successful single-run lifecycle.
