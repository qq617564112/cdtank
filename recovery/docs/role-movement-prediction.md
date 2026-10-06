# Native role OBB prediction

23 direct prediction cases and 5 complete controller cases pass.
Original `0x433d1c` (role vtable `0x5c2c28`, slot `+0x70`) copies the source OBB,
position, look and forward into the output and stack temporaries. Inputs below
0.001 only copy the OBB; exactly 0.001 enters integration. Commands 0–8,
record velocities, definition TankType and absent-definition default 1 execute
through original `0x435088`, `0x434cee`, `0x4344e7` and `0x433073`.

The predictor ignores its map argument and passes NULL to `0x435088`; original
`0x434cee` takes its no-map branch, without querying any NAV cell. A blocked
grid therefore produces the same dynamic prediction as a clear grid.

The wrapper caps prediction delta at 0.2. Direct 0.3 and 0.8 inputs produce the
same straight-motion distance as 0.2. The controller passes fixed 0.3 to both
roles' actual virtual `+0x70`; each native wrapper limits its trials to 0.2.
Controller cases include forward overlap, separated movement, backward
clearance, two moving roles and unchanged prediction with blocked NAV cells. Decisions use actual
gbengine `IsColOBB` at `0x10032ce0`.

Output position and rotation agree with the integrator's temporary vectors;
footprint dimensions are copied. Every source role's position, look, forward,
source matrix, center and complete 0x400-byte role fixture remain unchanged,
including blocked-NAV inputs and combined commands. Original engine matrix rotation executes,
with original bundled `msvcr71.dll` memcpy/cos/sin/fabs. Hooks observe calls and
inputs; they do not supply predictions, math, map queries or OBB decisions.

## Limitations

Role objects, records, definitions, a synthetic 100×100 NAV grid, controller
RB-tree and empty static scene container are supplied. NAV uses the observed
inline 0xa4-byte layer layout. Source velocities and footprint49/24/52 are
fixtures. NAV loading and upstream production of these objects are outside
this evidence. Browser production wiring is not established by native execution.
