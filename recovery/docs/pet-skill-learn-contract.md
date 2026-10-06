# Pet skill learning client contract

The original learning button has a concrete request and acknowledgement producer. `pet-skill-learn-contract-source.json` records its bounded source; `pet-skill-learn-codec-native.json` and `pet-skill-learn-receipt-native.json` execute the original serializers and one successful rank update. Both dedicated native processes exited0.

## Request eligibility

`MyPetSP/btnLearnSkill` at string5d1a0c is stored at page+134 by4ddf30. Registration4deace binds4dc23a, which calls49380b with page+cc owned instance and page+d0 slot.

49380b requires mode2, profile presence and a pet belonging to the original owned tree resolved by41e99c. It resolves PetTable from owned+8 and the next skill record from `owned[44+slot*4] + owned[5c+slot*4]`, through41e3c0. This is the next-level ID; the battle passive selector's base+rank−1 identifies the current level.

The current rank must be below PetTable's corresponding+a4 slot cap. Profile selector38 supplies the available skill-point balance, compared unsigned with the next-level record+18. Reaching the cap invokes callback0; insufficient points invokes callback2. Missing records return without sending. An accepted request sends but does not locally debit points or change the rank.

## Wire and success

| Message | Field order | Payload bits |
| --- | --- | --- |
| 3f92 request | instance32, slot8 | 40 |
| 3f93 reply | instance32, slot8, complete skill-point balance16, result8 | 64 |

Original request writer440c3f/reader492987 and reply writer498dd1/reader498e2e roundtrip those payloads with supplied bit-stream terminals. Socket framing is outside this evidence.

Shop listener491c88 registers receiver4958cb. It handles mode2 and treats result3 as success. After resolving profile and the owned instance, it sets profile selector38 to the reply's complete point balance through original5c4118+30/42fdea/420551, then increments the owned rank at5c+slot*4. The actual profile write is raw receiver+80, profile interface+a0 or container+c0. Other result values call feedback without changing rank; a missing owned instance causes no point/rank write.

The new single native success resolves instance83, updates slot4 rank1→2, writes point balance123 at container+c0 and invokes callback3. It is received-state evidence, not an original server transaction. In particular, the receiver increments once for each success packet it receives; deduplication cannot be inferred from this handler.

## Formal inputs and remaining qualification

The minimum proposed operation inputs are owned pet instance and slot. A formal result needs the complete point balance and the updated owned record/rank. Source eligibility distinguishes the current rank, PetTable slot cap and next-level skill ID. The selected battle source remains an independent frozen copy, so a future account learning transaction needs an explicit WAITING refresh policy rather than mutating a captured active battle source.

413cdd and41bb3c/41bb7f qualify the cost manager as the same manager+8c loaded under the name `petskill`. 41c478 constructs41b11f and stores its manager at+8c. Original manager vtable5c2374+4 creates the concrete record through43a711/43a698; record vtable5c4ca8+4 loads43a747. One complete native execution on original10212 maps 技能ID/技能类别/技能等级/花费技能点数 to+c/+10/+14/+18 and confirms next-level2 cost20. Original Pet loader43a91c places SkillLv0..5 at+a4..b8, the caps used by49380b. The price field identity is qualified. This source task adds no account transaction.

Original server ownership/slot authorization, atomic debit, duplicate handling, persistence and skill-point acquisition remain unresolved. This contract qualifies the original client request and rank acknowledgement, without recovering battle+a0 installation, passive activation policy, independent growth rewards or the full pet-growth goal.


## Prepared formal rule

`apps/shared/combat/pet-learning.ts` exports `quotePetSkillLearning`, taking a resolved owned pet, `{petId, baseIds, rankCaps}`, the price map `{skillId, groupId, level, cost}`, slot and current raw point balance. It returns an eligible quote, original cap/point feedback or undefined for absent source. It preserves the original order: next-level table lookup precedes the cap comparison. A maximum current rank may therefore resolve no next-level price and return without original feedback; a formal UI can separately display the known source cap.

The original complete sender native verifies exact-cost success, insufficient points, zero-cap feedback, maximum-rank missing-next-record, missing ownership and non-mode2 rejection. The pure quote matches the five mode2 outcomes and leaves inputs unchanged. The new native harness supplies SEH storage, table lookup and transport/UI terminals; explicit owned-rank fixtures do not prove ordinary acquisition.

The approved Web reconstruction gives only subsequent new purchases six initial rank0 values and leaves existing records unchanged. QUERY never grants points. Learning atomically spends the source next-level cost and increments one rank; WAITING success rebinds the selected source and cancels readiness, while PLAYING/participated FINISHED reject. Current16 and active skill casting remain unchanged. Point earning and the original server transaction remain unknown. The prepared passive quote for Pet2 slot4 is10251/cost200/rank0→1; the ordinary account and dual-state evidence is recorded below.


## Ordinary multiplayer and persistence

The unique compiled first run is `pet-learning-network-2026-10-05T19-06-05-701Z.json` (actual56151exit0; dedicated types35255exit0). A native copy of the lawful prior account database supplied unchanged owned records/funds. Only raw profile Point200 was set before service startup, explicitly as an unearned test fixture.

The guest normally buys Tank52 and a new Pet2; all six new owned ranks are0 and older owned pets stay unchanged. After normal selection/Create/Join and guest Ready, learning slot4 costs200, returns10251/rank1 and leaves Point0. Both WAITING snapshots cancel readiness and publish the independent six rank sources and selected2001/4020/10251; current16 remains2001/4020 plus zeros. The same request replays without another debit. Cap, foreign ownership, insufficient Point, conflicting request and PLAYING writes reject; complete account profile/owned records remain unchanged by those attempts.

The learned Tank52/Pet2 forward window covers24.99960 units over0.25 simulated seconds, matching speed100 against the same newly purchased zero-rank formula90. Server time is0.256 seconds and wall time0.254 seconds. All8 common PLAYING keys have identical complete players and expected skill sources. Both normal round1 Leave replies succeed.

After service shutdown, native SQLite reads Point0 and the same owned pet's slot4 rank1. Its full database backup and private0600 identity fixture are retained locally. The actual server restarts on the same temporary database and returns a complete PetSkillLearning QUERY equal to the saved final query. Final cleanup removes the temporary database and stops the server; port3605 was observed empty. `pet-learning-network-accepted.json` indexes this finite scope; independent main review is accepted in `pet-learning-network-root-review.json` with status `PASS_FINITE_PET_LEARNING_PURCHASE_WAITING_SOURCE_MOVEMENT_DUAL_STATE_RESTART_SCOPE`. The combined player-facing review `pet-skill-learning-root-review.json` accepts the network slice and ordinary UI actions costing200/10/20 points, with Point170 and ranks0=2/4=1, under `PASS_FINITE_PET_SKILL_LEARNING_PURCHASE_QUOTE_THREE_ACTIONS_DUAL_EFFECT_RESTART_CLOSE_SCOPE`. No full event-array equality or original earned-point policy is claimed.
