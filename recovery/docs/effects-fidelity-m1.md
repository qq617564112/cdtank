# Effect fidelity M1

The focused check `tests/effects-fidelity-m1.cts` covers the healing Effect11 used by item 1/skill 1 and item 2/skill 2. Both catalog entries select `{ effectId: 11, sound: "GA15", tag: 0, method: 3 }`.

The native non-retained tree rooted at node `2637` is preserved as `2637, 2643, 2663, 2664, 2665, 2666, 2667, 2830, 2834`. Its five drawn nodes are `2664, 2665, 2667, 2830, 2834` with types `1, 1, 1, 6, 6`; each has a published texture asset. Runtime evidence confirms Tag0 resolves to `tag_efcenter`, follows the live parent matrix, dispatches GA15 once, and cleans up on natural expiry, explicit stop, detach, and runtime stop.

M1 healing Effect11/GA15 passes within these evidence boundaries. GA15 is present at `recovery/output/web-assets/audio/sound/GA15.wav`.

Run `npx tsx tests/effects-fidelity-m1.cts` to regenerate `recovery/output/effects-fidelity-m1.json`.

## Limitations

This fixture checks consistency of existing native and runtime evidence; it is not new device presentation acceptance. The runtime geometry evidence uses NullEngine with fixture textures; it establishes submitted geometry and lifecycle behavior, without a comparison of original rendered pixels or audio samples. GA15 dispatch and asset availability are covered; actual playback is evidenced separately by the healing browser checks. Other drink effects have separate unfinished work: the missing `data\sound/ww051.wav` prevents ww051 native descriptor/device playback, and original second-slot behavior remains unresolved.
