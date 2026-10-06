# Tank maintenance source contract

The original client supplies a complete tank-maintenance quote, request, receipt and row-refresh contract. The recovered quote module is `recovery/evidence/roles/tank-maintenance-cost.ts`; it is not imported into production by this source task.

## Inputs and quote

Original Tank loader43b62a qualifies TankMoney at TankTable+48 and TankCoin at+4c. These are Tank fields, independent of TankShop prices. DataScale48 (`金钱修理1周与原价倍数`) supplies its original Max field at+30, currently50.

43b425 accepts currency0 raw coin or currency1 money and days1/7/30. Weekly raw coin cost is TankCoin; weekly money cost is signed32 TankMoney multiplied by DataScale48.Max. Day1 uses signed integer division by5; day7 uses weekly cost; day30 shifts weekly cost left once. The six tank3 native quotes are raw coin50/250/500 and money25000/125000/250000. Existing six-branch native and module evidence is reused.

## Ordinary request

Mend callback5183b3 maps tank buttons0..5 to kind2, the selected row's+9c owned instance, days1/7/30 and currency0/1. It calls4935dc on the shop manager. TankTable ID and owned instance ID are separate identities.

4935dc requires mode2, profile presence, an existing owned instance found through421f36, and an existing TankTable record obtained from owned+24. It reads raw coin via profile selector7 and money via selector26. The prospective uint32 `remainingMinutes + days*1440` must be at most367200 (255days). Unsigned available balance must cover43b425's raw cost. Insufficient coin/money invokes callback(kind2,result0/1); exceeding the duration cap invokes result2. Missing records return without sending.

Request3f90 is created by492854; writer492887 and reader4928e4 transmit fields in this order:

| Record offset | Value | Bits |
| --- | --- | --- |
| +c | owned instance | 32 |
| +10 | kind2 | 8 |
| +14 | days | 8 |
| +18 | currency0/1 | 8 |

The payload has56bits. Currency is an enum byte; neither displayed prices nor scaled currency amounts are transmitted in this request.

## Receipt and persistence projection

Shop constructor496cca registers495612 through wrapper491c4a/vtable5caea8. Listener typegetter498cd7 identifies reply3f91. Writer498be9 and reader498c6c transmit120bits:

| Record offset | Value | Bits |
| --- | --- | --- |
| +c | owned instance | 32 |
| +10 | complete raw coin balance | 32 |
| +14 | complete money balance | 32 |
| +18 | days | 8 |
| +1c | kind | 8 |
| +20 | result | 8 |

Complete handler495612 only processes mode2. Result4 is success. It obtains profile through4269c4, sets selector7 to the returned raw coin balance and selector26 to returned money balance, then finds kind2's owned instance through421f36 and adds `days*1440` to its+34 remainingMinutes. Raw420551 writes coin/money at its receiver+74/+70. Original profile vtable5c4118+30 dispatches42fdea: the profile interface is container+20, and this wrapper adds another20 before the raw setter. The original container offsets are therefore coin+b4 and money+b0. The receipt does not locally recompute debit. An unknown instance still receives the complete balance writes before lookup failure; it does not change a tank or invoke the success callback.

Results other than4 call the UI feedback callback with kind/result and leave balances and duration unchanged. UI51983d interprets0 as insufficient coin (GameString61),1 as insufficient money (60),2 as no further maintenance allowed (62),3 as `Can't Mend`,4 as success, and5 as unknown system error (706). Other result meanings are unqualified.

On success, UI5198bd refreshes displayed balances through51846c. For the selected tank row, it looks up the same instance, formats remaining days through4d88f1 and replaces the row text through517716 before refreshing the list. The original remaining-day text uses ceiling division by1440, as qualified in the existing owned-row source.

## Cost text and currency units

Coin cost controls are `ShopMendPage/txtCoin0..2`, owner+84/+88/+8c. UI519ac7/519b2e/519b8c calls43b5b3 for days1/7/30. That function reads TankCoin+4c and multiplies by original double constants .02/.1/.2 respectively, formats with `%.1f`, parses through43079b, and passes the resulting double to4b4ad2 before the text setter. Thus tank3 displays5/25/50 coin units. The internal intermediate has one decimal place; the subsequent number stream determines the final text. Coin day1 display directly rounds the floating TankCoin*.02 value, rather than first truncating the raw transaction cost divided by5.

Money controls are owner+90/+94/+98. UI519bee/519c49/519ca4 calls43b425 with currency1, then integer number stream487c36 and the text setter. No coin scaling applies.

Profile coin display is independently obtained through431b3f and formatted in51846c. Its source identity is distinct from the raw selector7 balance used in requests and receipts.

## Evidence and limits

- `recovery/output/tank-maintenance-cost-native.json`: original six cost branches.
- `recovery/output/tank-maintenance-cost-module.json`: pure module compared with those six quotes.
- `recovery/output/tank-maintenance-receipt-native.json`: original request/reply serializers with supplied bit-stream terminals; receipt handler, raw420551 setter and tree lookup using a supplied profile vtable that calls the raw setter directly; eight success/rejection/mode/missing-instance conditions. Its container+90/+94 writes belong to that simplified provider. Native process exit0.
- `recovery/output/tank-maintenance-profile-wrapper-native.json`: one success through original5c4118/42fdea/420551, original container+b0/+b4 writes and owned+34 duration increment. Native process exit0.
- `recovery/output/tank-maintenance-contract-source.json`: bounded original disassembly, display constants, rejection strings and minimum formal inputs.

The original server's authorization, atomic debit, request deduplication, durable write and passage-of-time decrement are not supplied by these client functions. A formal server transaction can implement those explicitly as reconstruction while reusing the qualified quote, units, cap, owned-instance identity and duration increment. These results do not establish pet battle+a0 binding, complete damage calculation, critical probability/multiplier or a playable maintenance transaction.
