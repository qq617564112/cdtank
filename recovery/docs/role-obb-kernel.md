# Original OBB intersection kernel

The service `intersectsOriginalObb` matches 1,139 executions of original
`gbengine.dll` `IsColOBB` at `0x10032ce0`. The original executable import
pointer at `0x5c0ba8` resolves to that entry. The fixture executes the complete
function, matrix-axis reader `0x10030800`, projection-radius helper
`0x10032b50`, cross product `0x1002f420`, and executable CRT `fabs` at
`0x57d261`. It substitutes no intersection or arithmetic result.

`RoleObb` carries the original 16-element matrix and three full dimensions.
Matrix elements `0..2`, `4..6`, and `8..10` are the three axes;
`12..14` are the center. Role dimensions `49,24,52` are full widths:
identity boxes separated by exactly 49 on X, 24 on Y, or 52 on Z intersect.
The next representable float32 separation in either direction does not.
The kernel includes height, uses the supplied axes without normalizing them,
and preserves the original arithmetic for scaled orthogonal matrices.

Six face-axis comparisons determine the original boolean result. Each tests
absolute center projection against the other box's projected half dimensions
plus the current box's corresponding dimension times `0.5`; strict greater
rejects. The cross-axis loop runs in the binary, but its separation branch at
`0x10032f44` targets `0x10032f62`, which returns 1. It cannot reject an
intersection. Twenty supplied oblique pairs reach a separating cross axis and
still return 1. The service preserves this behavior.

The service rounds matrix values, dimensions, center differences, center dot
products and stored radius accumulations to float32. Dot products follow the
original Z, Y, X order. The projection helper stores its first weighted term
and first-two-term sum as float32; its third weighted term remains in the x87
register until the caller stores the combined comparison radius as float32.

The oracle explicitly uses x87 control word `0x027f` (53-bit precision, nearest
rounding, masked exceptions), also present in the executable CRT at
`0x5e3478`. Extended precision `0x037f` yields the same booleans in all fixtures.
Unicorn's initial control word 0 selects single precision and differs on four
rotated near-touching cases; the fixture records their names.

Coverage includes both signs of all three axes, exact touching and next-float
separation, unequal dimensions, height, yaw/pitch/roll and oblique rotations,
near-touching rotated boxes, world-center subtraction, scaled orthogonal axes,
800 deterministic oblique pairs, 80 reversed pairs, and 120 scaled oblique
pairs. Every original call reaches its return with the expected stack cleanup.
The TypeScript test compares every exported matrix and result directly.

Run from the repository root:

```
recovery/.venv/bin/python recovery/evidence/movement/role-obb-kernel-native.py
npx tsx tests/role-obb-intersection.cts
npx tsc -p apps/server/tsconfig.json --noEmit
```

## Limitations

Matrices and dimensions are fixture inputs. This evidence establishes the
service intersection kernel; it does not execute the controller, prediction,
navigation, runtime OBB production, or browser integration. Application startup
and its FPU-state changes are not traced. Equivalence is established for the
recorded finite float32 matrices and the explicit CRT precision mode; this is
not an exhaustive proof over arbitrary matrices or altered rounding modes.
