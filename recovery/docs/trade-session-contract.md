# Trade session source contract

The original client has a distinct invitation, offer, confirmation and settlement pipeline. `trade-session-contract-source.json` captures the named message vtables, codecs, callbacks and owned-record consumers. `pet-skill-point-transfer-native.json` supplies the existing executed scalar settlement evidence. This contract qualifies client transport and presentation; it does not supply original server authorization.

## Messages

All sizes below are bit widths. Message payloads follow the original bit-stream codec.

| ID | Sender / receiver | Payload and consumer |
| --- | --- | --- |
| 3f9a | 494cf0 / invite request | Peer ID32; original peer profile ID comes through 4f1f59. |
| 3f9b | 491836 | Peer ID32, result8. Result4 calls Shop+84(peer); 0/2/3/5/6 call Shop+80(result). |
| 3f9c | 494e6b | Peer ID32, accept1. 4eff28 passes true; 4eff91 passes false. |
| 3f9d | 4918cc | Peer ID32, result8. Shop+88 receives identity and result. |
| 3f9e | 494f56 / 495704 | Serialized offer followed by result8. Result4 dispatches offer to Shop+8c; result3 dispatches feedback3 to Shop+90. |
| 3fa0 | 4933c0 | Side32; called when SHOW is switched off at 502c15. |
| 3fa1 | 495782 | Side8, result8, dispatched to Shop+94→4fca10. These are not two independent confirmation booleans. |
| 3fa2 | 494fe0 | Participant A32, participant B32, side8. CONFIRM caller 4f9a2e supplies peer and side. There is no separate action byte. |
| 3fa3 | 4957f7 | Participant A32, participant B32, side8, status8, then three count16-prefixed vectors of original pet, tank and item records. |
| 3fad | 49505f | Peer ID32, side8. Cancellation callback 4fd161 sends this message before clearing and closing the page. |

For 3fa2, side1 writes the peer into packet+10; the other side writes packet+c. For 3fa3, side1 dispatches packet+10 and side2 dispatches packet+c to the session callback. The callback's peer ID resolves the original manager40+190 table through 420ff8. Page+94 is peer identity and page+98 is side.

## Offer records

Writer49328d encodes participant A32, participant B32, side8 and entry count8. Each entry begins with kind8: kind0 calls original pet writer41e42e, kind1 calls original tank writer42195e, and kinds2..8 call original item writer42dddd. The tail is money32, originality16 and skill points16, from offer+18/+1c/+20 respectively.

These are owned-record serialization routines, not just base IDs. The SHOW constructor502aab..502bca references the original owned pet/tank and kinds4..8 item records. Kinds2/3 allocate a new0x30 item record through43bcb5, copy only instance+4/owner+8/base+c, and write the UI's offered quantity into+10. Their offer is a partial quantity; its remaining fields come from the new record constructor.

- Pet includes instance at+0, base/type at+8, six skill bases+44..58 and six ranks+5c..70, plus its other serialized properties.
- Tank includes instance at+1c, base/type at+24 and remainingMinutes at+34, plus its other serialized properties.
- Item includes instance+4, owner+8, base/type+c and quantity+10 encoded in24bits. State+20/+24/+28/+2c also travels in the original codec.

Status19 in 4957f7 inserts the received vectors before invoking the session callback. Pet insertion41f1cc indexes the received record's instance+0; tank insertion422640 indexes instance+1c. Received record pointers are freshly decoded; these consumers do not allocate replacement instance IDs. Item insertion clears record+1c before43eb4e. Its same-base existing-item branch replaces existing quantity+10 with received quantity+10; it does not add the received quantity locally. The received list therefore supplies the resulting quantity for this branch.

Scalar settlement503805→49340b applies `current + peerOffer − ownOffer` to money, originality and skill points. Existing native execution proves Point200+100−70=230, money1000+500−300=1200 and originality50+25−10=65 through the original profile wrappers. This is balance transfer, not point earning.

Outgoing pet removal uses instance+0 with41f05a; tank removal uses instance+1c with422565. Item removal43d583 uses instance+4: kinds2/3 use quantity+10, kinds4..8 use one. Kinds2/3 have a same-base lookup in the peer offer that skips this removal path; this client branch alone does not specify authoritative merging or netting.

## Page state

SHOW callback5029f2 requires an enabled control and page+20=false. It constructs the own offer, sends3f9e and sets+20=true. Turning SHOW off calls4933c0→3fa0.

CONFIRM callback4f9a2e requires an enabled control and page+21=false. It sends3fa2, sets+21=true and disables SHOW. Show reply callback4fca10 compares the incoming side with page+98. A different side clears the peer offer, resets+21, disables CONFIRM and enables SHOW. A matching side clears the local SHOW state and updates the confirmation control.

Cancellation4fd161 sends3fad and clears both offer objects through4fcbe9. Local close4fd13e clears and closes without sending a message. Server settlement status19 remains a distinct event from either local SHOW or CONFIRM.

## Authority boundaries

The Web policy—draft offers, SHOW locking, both shown before CONFIRM, modifications resetting both locks, cancellation without settlement—has no contradiction in this captured client path. Its authoritative gates and atomic persistence remain explicit reconstruction. Original server validation, complete status names, allocation of received instance IDs and point earning remain unresolved. Preserving received pet ranks and tank minutes is supported by the record codecs; granting ranks, minutes or points is not.

This slice captures named static source once and reuses the existing settlement execution. It contains no service, browser, production change or ordinary transaction claim.
