# Role movement OBB prediction

`predictRoleMovementObb` reproduces original role virtual `+0x70` at
`0x433d1c` using the recovered movement mathematics and original matrix
conversion. It copies the source matrix and dimensions when float32 delta
is below 0.001. At and above 0.001, it integrates copies of position, look
and forward with delta capped at float32 0.2, then rebuilds the matrix while
retaining source dimensions. Prediction performs no NAV sampling. The
controller's supplied 0.3 therefore predicts 0.2 seconds of movement.
Neither input pose nor source OBB is mutated.

`createRoleObbFromPose` reproduces original `0x433073` and engine Y rotation
`0x10030220` / `0x10030190`. It clamps float32 forward.z to [-1,1], computes
acos, and for negative forward.x subtracts the angle from the original
float32 constant 6.283180236816406. The angle is multiplied by original
57.295780181884766 and stored as float32 degrees. Engine conversion uses
0.01745329238474369: cosine receives the unrounded product, sine receives
the product stored as float32. The engine resets all 16 matrix entries to
Y rotation and then writes position. Look does not determine OBB rotation.
The constructor footprint is [49,24,52]; callers can supply existing OBB
dimensions.

The west vector [-1,0,0] produces 269.9997253417969 degrees. The zero vector
produces 90 degrees. These follow the original acos/sign conversion.

## Verification

Run:

```sh
recovery/.venv/bin/python recovery/evidence/movement/role-movement-matrix-native.py
npx tsx tests/role-movement-obb-prediction.cts
```

The matrix oracle executes original `0x433073`, engine rotation and bundled
msvcr71 acos/cos/sin/memset. Its hook only observes the rotation call.
18 matrix cases cover cardinal directions, clamped z, zero forward, both
heading signs and nonzero position height. Source dimensions remain intact.
The service test compares these matrices, the existing 23 complete native
prediction cases and 10 matrices consumed by five complete native controller
cases. All 51 matrix comparisons have zero observed error; source pose and
OBB remain unchanged. Prediction cases cover commands 0–8, negative/zero/
below/exact-threshold delta, the 0.2 cap, record velocities, definition type
and missing-definition default 1, and blocked NAV ignored by prediction.

Evidence: `recovery/output/movement-obb-matrix-native.json` and `.log`, plus
`recovery/output/movement-prediction-native.json`.

## Limitations

The matrix oracle supplies pose and [49,24,52] dimensions. Later role footprint
resizing is unresolved. Prediction consumes caller-resolved tank type and
record velocities; record/definition lookup remains the caller's responsibility.
The recovered movement mathematics supports horizontal directions and positive
turn velocity for arc commands. Native prediction fixtures use the explicit
source pose [200,0,200] with look/forward [1,0,0]. The separate native movement
mathematics evidence covers other horizontal directions. This service evidence
does not establish map loading, role creation, controller wiring or browser
behavior.
