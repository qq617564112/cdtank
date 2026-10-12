# Paid tank4 acquisition

Tank4 飞毛腿 is purchasable through the normal ten-product Tank Shop catalog for3500 coins. Purchase creates a complete owned equipment record, Home saves its selection, and the selected source-textured tank enters an ordinary map7 match. Ownership, balance and selected instance survive an actual server restart using the same SQLite database and original account token.

## Transaction and ownership

The buyer fixture begins with4500 coins and1000 tokens, complete owned pet1/tank1 records and no owned tank4. An isolated peer has5 coins. QUERY returns the ten positive-price mode2 products3,4,52,53,54,102,104,152,154,155. The tank4 card exposes3500 coins and350 tokens; mode2 accepts coins only.

BUY creates instance1 and debits4500→1000 coins, leaving tokens1000. Its equipment record has21 fields. Source tankshop textures are turret40211, body40212 and tracks40013; source tank attack/bonus and defense/bonus are110/70 and15/33. Other nonidentity fields are zero as required by the delivered purchase record. OwnedRoles returns the same complete record and SelectRole stores instance1 at profile+0xa8.

The peer's insufficient-funds BUY is rejected with no added ownership and balance5. Authentication, invalid product, unsupported currency, invalid request ID and cross-account selection gates pass. Replaying the accepted purchase returns the same record without another debit; conflicting reuse is rejected.

## Real match and persistence

The network runner creates map7/mode4 with two authenticated human players and one CPU. The bought tank4 moves160.003517 units through ordinary input, aims to.3281 radians and fires ordinary2001. Both humans receive identical complete players arrays across30 common PLAYING snapshots, including selected tank4 and its source texture values. Both normal Leave API calls succeed.

The server is stopped and started against the same SQLite file. Reauthentication with the original buyer token restores the exact purchased21-field record, selected instance1 and balance1000/1000. No preowned tank4 or runtime pose/combat/event injection is used.

## Production browser

Two isolated production pages use native Shop QUERY and selection of tank4. The low-balance peer sees the insufficient-funds result. The buyer sees 飞毛腿, its source description and the separate3500-coin price, buys instance1, and sees1000 coins remaining in both Tank and Item shop pages. Normal Home selection saves instance1 and its preview publishes source textures40211/40212/40013.

The bought tank enters map7/mode4 with the authenticated peer. Actual W movement covers176.003806 units; ArrowLeft changes aim to.3281 radians; Space produces a normal fire event. Complete players arrays match over40 common PLAYING snapshots. Render observation records10 actual mesh submissions with ready source textures `/tank-textures/role/004/004M_021.png`, `004U_021.png` and `004XY_001_A.png`. The battle screenshot shows the source red-and-white tank body and turret.

Evidence:

- Network PASS: `recovery/output/tank-paid-network-2026-10-04T15-09-34-737Z.json` and matching `.log`.
- Browser accepted scope: `recovery/output/browser-tank-paid-2026-10-04T15-10-40-588Z-analysis.json` (`PURCHASE_RENDER_CONTROLS_ACCEPTED`, full run `FAIL`).
- Browser raw: `recovery/output/browser-tank-paid-2026-10-04T15-10-40-588Z.json` and matching `.log`.
- Actual screenshots: `browser-tank-paid-2026-10-04T15-10-40-588Z-purchased.png`, `-home-tank4.png` and `-battle-tank4.png` in `recovery/output/`.
- The prior raw capture `browser-tank-paid-2026-10-04T15-09-56-254Z.json`, its log and screenshots are retained.
- Runners: `tests/tank-paid-network.cts` and `tests/browser-tank-paid.mjs`; strict standalone TypeScript and JavaScript syntax checks pass.

## Limitations

The second browser capture verifies peer normal Leave. Host normal Leave was not executed: final snapshots show FINISHED/FORFEIT after the peer left, where `[data-leave-room]` is available without `[data-battle-play-summary]`. The runner now waits for a visible enabled Leave or waiting-close entry and chooses it from the actual phase; no third browser run was made. Network normal double Leave and restart evidence is complete. All clients, browser contexts, server/browser processes and temporary data are cleaned; ports3253,3254,5414 and9614 have no listener. Live acceptance covers tank4, while the other nine catalog entries use shared source catalog rules.
