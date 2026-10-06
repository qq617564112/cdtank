# Tank1 numeric network and browser acceptance

Two authenticated players using complete owned pet1/tank1 records in mode4/map7 receive identical authoritative player snapshots. Ordinary movement, movement-look rotation, turret aim, six-round default2001 reloads and ammunition switching match the recovered source values.

## Fixture and source values

Both accounts own pet instance73 and tank instance74. The records include every source-template field, with condition+0x34=0, HP600, tank1 source mastery and no equipped parts. The host owns item2007 instance77 and assigns it to hotkey2 through the normal Kitbag operation. Match control uses ordinary PlayerInput; the browser sends actual Chromium keyboard events through the production input handler.

Expected values use tank1 and pet1 source tables, combatItems2001 skills and combatLimits. Movement accumulators use limits14/15, source mastery decrements to at least1, move scale10 and f32 turn scale0.06981316953897476. Result: speed140 and look/aim rate0.6806783676147461 rad/s. Ordinary2001 contributes Delay17, LoadTime100 and MaxBullet6; tank1 contributes TankDelay0 and TankBullet0. After limits16/17, ordinary reload is f32(17 × f32(.1)) = 1.7000000476837158 s. Final-round reload is f32((17 × f32(.1)) ×100 × f32(.03)) = 5.099999904632568 s. Capacity is6.

The server advances fixed 50ms simulation steps. Movement rates use snapshot tick differences; wall-clock snapshot timing is recorded separately.

## Measured network results

| Ordinary input | Simulation duration | Wall duration | Measured change | Rate | Absolute rate error |
|---|---:|---:|---:|---:|---:|
| Forward | .35s | .354s | 49.002425 units | 140.006928 units/s | .006928 |
| Reverse | .35s | .351s | 48.999762 units | 139.999319 units/s | .000681 |
| turn+1 | .75s | .751s | yaw+.5105 rad | .680667 rad/s | .000012 |
| turn−1 | .75s | .756s | yaw−.5105 rad | .680667 rad/s | .000012 |
| aim+1 | .75s | .755s | aim+.5105 rad | .680667 rad/s | .000012 |
| aim−1 | .75s | .752s | aim−.5105 rad | .680667 rad/s | .000012 |

Forward/reverse contain movement on every measured step; stop distance is0. The independent bodyYaw stays−1.8405 throughout these segments. The measured yaw is movement-look rotation, not hull angular speed.

The first seven shots occur at ticks90,124,158,192,226,260,362. The first five gaps are34 ticks each; the final-round gap is102 ticks. Observed wall intervals are1.712,1.709,1.713,1.709,1.713 and5.120 s. Public reload durations match source normal/final values. Returning from confirmed2007 to confirmed2001 preserves magazine1/6. Both connections have identical complete players arrays over515 common snapshots.

## Production browser results

Two isolated authenticated browser pages use the same owned fixture and normal Home assignment, CreateRoom/Join/Ready flow.

| Real keyboard | Sent input | Observed change |
|---|---|---|
| W / S | move+1 / −1 | 56.003989 units each |
| A / D | turn+1 / −1 | yaw+.2722 / −.2723 rad |
| ArrowLeft / ArrowRight | aim+1 / −1 | aim+.2722 / −.2723 rad |
| Space | fire=true | Two normal2001 fire events; magazine4/6 |
| 2 then1 | useItem2 then1 | Confirmed2007 then2001; magazine4/6 preserved |

BodyYaw stays−1.8405 during A/D. Complete PLAYING players arrays agree on224 common room/round/tick/phase snapshots. These checks establish the production keyboard mapping and magazine publication; they do not establish A/D hull rotation.

## Evidence

- Runner: `tests/tank-numeric-network.cts`; strict standalone TypeScript check passes.
- Network accepted analysis: `recovery/output/tank-numeric-network-2026-10-04T14-34-12-516Z-analysis.json`.
- Production keyboard runner: `tests/browser-tank-numeric.mjs`; JavaScript syntax check passes.
- Browser accepted control/synchronization analysis: `recovery/output/browser-tank-numeric-2026-10-04T14-37-21-390Z-analysis.json`.
- Actual screenshots: `recovery/output/browser-tank-numeric-2026-10-04T14-37-21-390Z-failed-1.png` and `recovery/output/browser-tank-numeric-2026-10-04T14-37-21-390Z-failed-2.png`.
- Original captures and server logs are retained alongside the analyses.
- Separate `tests/tank-controls-authority.cts` evidence covers21 source tanks × condition0/1 in normal World simulation. This network/browser acceptance covers tank1 only.

## Limitations

The accepted analyses reuse recorded live traffic. Browser normal Leave was not reached; page contexts and server/browser processes were disposed by cleanup. Ports3250,3251,5411 and9611 have no remaining listener. Network public movement-look and aim rates pass; hull-following behavior requires separate source/control interpretation.
