# Native controller movement gate

19 bounded cases pass through complete original `0x4272d7` (controller vtable
`0x5c3a18`, slot `+0x40`) and real gbengine `IsColOBB` at `0x10032ce0`.
Dynamic role overlap returns 0 through `0x4275ba`; empty trees, status 3,
same ID, and absolute X or Z separation above 200 allow movement. Separation
exactly 200 reaches the real OBB test. Both coincident and rotated overlap
reject, while nearby disjoint OBBs allow movement.

The original role getters, matrix OBB copies, RB-tree successor and static
container readers execute. Static overlaps dispatch type 100 to `0x44e081`
and do not reject movement. Eight overlaps cause no diagnostic; nine dispatch
one diagnostic and still return 1. Every case reaches the original return
with correct stack cleanup.

## Limitations

RB-tree nodes, role records, source OBB matrices and scene container are supplied.
CRT memcpy copies the original bytes; engine fabs uses native executable CRT
`0x57d261`. Map-present cases supply virtual `+0x70`
with rigid OBB translation to establish dispatch and its use by the real OBB
test; original `0x433d1c` prediction and `0x435088` map integration are not
executed. Notification `0x44e081` and diagnostic `0x40bd28` are recording sinks;
their downstream effects are outside this evidence. Runtime production of these
objects and browser collision-controller wiring remain unproven.
