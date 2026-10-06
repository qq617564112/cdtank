# Ordinary Breach map selection

The original published room catalog contains three legal mode5 maps:20,21 and22. Their current ScenePreview destruction consumers cover every model family in each scene. Map19 and map23 have no room-map row in any mode, so neither can be selected through ordinary room creation.

| Scene | Original Breach resources | Current ordinary entry | Missing interface |
| --- | --- | --- | --- |
| 0019 |47 placements: obj05428×35, obj05463×12; both original POL/c9/DDS exist, five and ten geometry nodes respectively | No MAPS entry | Explicit legal map registration and room policy; generic mode5 objective creation alone does not expose the scene |
| 0023 |46 placements: obj05423×22; obj05421/05443/05433/05432×6 each | No MAPS entry | Explicit legal map registration and room policy |

The existing mode5 objective producer maps original Breach identities to rebuilt HP200 and ordinary objectiveHit/objectiveDestroyed events. The active collision map allowlist covers20/21/22. A further mode5 map therefore needs an explicit room registration decision before an ordinary authoritative acceptance can be run. Original source assets alone do not establish a legal mode5 map rule.

Legal mode4 maps7/14/17/18 provide a separate ordinary scene-object lane. Map17 has12 obj05469 placements using the already verified c9/GA33 family. Whether this lane is selected depends on the explicit scope of its server scene-object producer; it does not make map19 or23 legal.
