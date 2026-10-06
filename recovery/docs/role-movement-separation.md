# Role overlap separation

Original `0x426b92` resolves the first intersecting role in controller tree
order by placing the requested role 60 units from the other role and validating
that candidate against NAV. Twelve native cases execute the complete routine,
original role getters/setters, engine OBB/rotation, vector math, actual NAV
sampling and bundled CRT imports. The network pose state-0 path at `0x42823e`
also executes completely and calls separation from `0x42833d`.

The routine reads scene `+0x60`, returns when it is null or recursion depth
exceeds 50, and copies the requested role's current OBB. Tree entries with
matching role IDs or status 3 are skipped. It intersects the copied OBB with
each remaining role's current OBB. For the first overlap:

1. Copy requested and other positions. Subtract other from requested and run
   original `0x424043` normalization.
2. If original `0x423ff1` length is less than 1, replace only direction.x with
   original `0x410069(0,1)` and normalize again.
3. Scale the direction by original float32 60 and add the other position.
   Original `0x433112` writes requested position, copies its old position to
   previous position and rebuilds its OBB with original `0x433073`.
4. Read scene-data `+4` NAV pointer and validate through original `0x434cee`,
   command 0, delta 0, actual role look/forward/current OBB, definition TankType
   and record move/turn velocities.
5. On acceptance, call original `0x4229cd` pose wrapper and return. On failure,
   call `0x433112` with the **other role's position**, recurse at depth +1,
   and return. The second supplied argument is unused by this routine.

This is a candidate placement procedure. Acceptance tests NAV; it does not
recheck the role OBB against other roles after placement.

## Random production

Original `0x410069` calls KERNEL32 `GetTickCount`, seeds EXE `srand` at
`0x57cbbe`, and calls EXE `rand` at `0x57cbcb`. The seed is stored at thread
state `+0x14`; rand updates it with `seed * 214013 + 2531011`, takes bits
16–30 and multiplies by original float32 `1/32768`. Original arithmetic is
executed. The native harness supplies the OS clock return and CRT thread-state
pointer at `0x58139a`; it supplies no random vector or normalization result.

Clock 12345 produces rand 7584, direction.x 0.2314453125, which normalizes to
+X and separates coincident centers by 60. Clock 1 produces rand 41 and
0.001251220703125. Original normalization treats its squared length as below
0.0001 and zeros the vector. Clear NAV accepts that unchanged center, leaving
the roles overlapping. The random branch is triggered by computed length less
than 1, including any direction whose normalized result still satisfies that
comparison; its scope is wider than exact coincident centers.

## Verification

```sh
recovery/.venv/bin/python recovery/evidence/movement/role-movement-separation-native.py
```

The selected real NAV is `Data/scn/0001/0001.nav`. Cell bytes are copied
unchanged from the extracted original file using the observed inline layer
layout. Clear and blocked neighborhoods are chosen from those source cells.
Positive and negative offsets produce +60 and -60 placements. Coincident
centers cover both supplied clock values. Same ID, status 3, non-overlap and
depths 50/51 have explicit branch assertions. The network state-0 pose call
observes separation's original caller return `0x428342` and successful movement.

Each blocked case executes depths 0–51: 51 failed command-0 NAV trials, followed
by the depth-51 return. The final requested position equals the other center.
All cases assert the other role's complete 0x400 bytes remain unchanged and
dimensions remain [49,24,52]. Changes to the requested fixture are restricted
to current/previous position and the matrix; command, look, forward, center,
record and definition remain unchanged.

Results and call traces are in `recovery/output/movement-separation-native.json`
and `.log`.

## Limitations

Roles, records, definitions, a single-node controller tree, scene NAV pointer,
OS clock values and CRT thread storage are supplied. The actor pointer is
absent, so the original pose wrapper executes without a visual actor callback.
NAV loader and initial/local-correction caller `0x428167` are not executed.
The complete network caller uses state 0; other network states and multi-role
separation order are outside these fixtures. Later footprint resizing and
production server/browser integration are not established by this evidence.
