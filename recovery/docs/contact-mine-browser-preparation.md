# 地雷3002正式网页准备

Owned仅 `tests/browser-contact-mine.mjs` 与本文，端口3667/5697/9897；正式政策和原资源合同见 `mine3002-policy.md`、`mine3002-presentation.md`。最终有限范围已由root独立审收，网络与首轮/尾段范围分列。

现正式入口已足：正常token/main导航→Shop Weapon选择3002，数量1/MONEY20普通BUY→响应真实新instanceqty1；不与既有库存合并、不预填实例。Home rdoWeapon列表选择该instance，Kitbag1/hotkeys[0]普通ASSIGN，Digit2原placeTrap。购买前原库存全文保，实际receipt与所有旧receipt留存；不补资金、Point或owned，不补Login。

普通map7/mode4双Create/Join/Ready。host先原A/D面向peer，bodyYaw对peer bearing差≤0.03（不移动/注入pose），再原Digit2本人位置放置，双trapPlaced3002、原modelId3002、库存新qty1→0。对象expiresAt按实际快照核30服务器秒。先取得双端原地面模型真实renderframe，再host原KeyS后退到距放置点≥100；peer原A/D/W走向对象直到首合法圆接触≤30。正常移动按实时authority闭环，不推速度、不注入位置、不绕正式碰撞。

双trapTriggered4023与唯一hit4023同源；直接value300、targetpeer，目标HP−300，ownerHP保持；没有普通弹药critical/shotPlayerResult。对象立即移除，接触在expiresAt前。每端完整snapshot按room/round/phase/tick/serverTime全文相等，网页players逐页匹配该连接自身tick。

只读observer关联同SkillEffectNotifications.play上下文。GroundTrapsPresentation原03002.POL的groundTrapId、实际mesh onBeforeRender记录Scene帧、世界矩阵、原纹理/geometry/alpha；native X反射与yaw0/scale1为已明确Web规则。spawnAttachedEffect返回handle→runtime.instances→实际drawOwner mesh/vertexColorAlpha正向renderframe，3002绑定owner原010、4023绑定target原008，tag0/oneShot。

两树无type4声音节点；本片非零roleId正式外层声音分别为SE02/SE31。playSkillSound返回handle沿runtime.skillSound.voices保存真实audio引用、位置/gain、playing/currentTime、ended与资源；不借用runtime.sound或无关全局声音。效果自然结束、声音ended后原phaseLeave/HomeStrictClose，模型/指定effect实例/mesh/voice清零。无新FX/声音/wire或旧陷阱矩阵。

双Home库存核新instanceqty0（记录允许absent），原库存全文保持；普通cold双Account token认证Inventory/Equipment/OwnedRoles/PetLearning与native profilebytes/strings/库存/owned/hotkeys全文对应，正式BUY receipt与旧receipt相等。断开、同tempDB正常stop/start，再双四QUERY全文相等。唯一writes是普通BUY1与ASSIGN1；Runtime.exceptionThrown=0。

finally立即保存observer、trusted nativekeys/PlayerInput、事件与每页最多1000retained snapshot（非fullsession）、checkpoint/private0600与四项清理。FAIL保原raw，追加运行需root具名授权。3666finalsource已冻结如下；本稿不声明3002实际完成。原Func12/2 caller、Range80用途、原几何/像素与高清全部内容父项保持开放。

坐标资格：放置trap.x/y/z与正式trapPlaced事件原值strict相等；owner快照x/z仅按mine坐标round2投影比较。接触圆只用正式hit事件完整x/z与mine完整double，正常navigation读取的player round2投影不作为闭边界几何oracle。

## 冻结合法source

`recovery/output/contact-mine-network-root-review.json` / `PASS_FINITE_ORDINARY_BUY3002_KITBAG_SINGLE_HOSTILE_CONTACT_DIRECT300_DUAL_STATE_NATIVE_RESTART_SCOPE`，actual12365/exit0。source checkpoint225280B0600与identity0600：

```sh
node --import tsx tests/browser-contact-mine.mjs \
  --fixture recovery/output/contact-mine-network-2026-10-06T01-58-15-152Z-identity.private.json \
  --database recovery/output/contact-mine-network-2026-10-06T01-58-15-152Z-checkpoint.sqlite
```

入口绑定review精确status/raw/checkpoint及native/coldreceipt/restart/cleaned门禁。source host MONEY62820、旧19item3002qty1/slot1；网页再普通BUY1扣20至62800，必须另一真实新instanceqty1，旧19全部字段保持，合计1→2。正常ASSIGN新instance/Digit2 soleconsume新1→0，旧19qty1保持、合计2→1。首次双Ready确认ownerPet102maxHP650满血、peerPet103maxHP750满血；唯一direct300后peer450、owner650。普通native与coldrestart继续全文核旧19、所有旧records/receipt；source网络有限接触与网页原model/attached/sound待实际范围分列，不冒网络证GPU。

## 首有限范围与必要contact tail

首84789/exit1 raw `recovery/output/browser-contact-mine-2026-10-06T02-03-45-797Z.json` 保FAIL。有限审 `recovery/output/contact-mine-browser-first-root-review.json` / `ACCEPTED_FINITE_ORDINARY_WEAPON_BUY3002_NEW20_KITBAG_NATIVE_PLACE_CONSUME_DUAL_GROUND_SOURCE_ONLY_CONTACT_FX_SOUND_CLOSE_RESTART_UNREACHED_SCOPE` 收普通Weapon BUY20qty1/MONEY20、ASSIGN20slot1、原Digit2使用20至qty0，双放置事件及后续双实际groundT1；291共同完整snapshot、22groundkeys、0contacthit。原生独立expected、旧19qty1/owned/receipts保持。原model/effect/sound仅finallypartial，未包含完整消费者资格。

必要tail入口严格绑定此review/raw/checkpoint/nativeExpectedEqual、old19/owned/receipts保持、soleBUY20/ASSIGN20、双itemUsed+placed3002、实际laterground、库存20qty0/19qty1、Runtime0和cleanup。沿first实际checkpoint/private，不回更早库。跳全部Shop BUY；原购买/放置有限scope引用。正常Home Weapon选择19qty1重新ASSIGNslot1，原20qty0全文保持；新普通房不恢复旧ground/session。owner原A/D朝peer≤.03，再Digit2 soleconsume19至0，正常退让/peer接触及原model+attached010008/SE02SE31全部门禁保留。放置后先等待两端实际snapshot groundpresent与消费后Inventory再读取trap，正式事件不能替代snapshot门禁。

本tail唯一write是ASSIGN19slot1，0BUY/重复20消费；最终19qty0及旧20qty0合计0，父购买20真实requestId receipt与所有旧receipt保持。双phaseLeave/HomeStrictClose、fullnative/cold四QUERY、同库正常stop/start后双四QUERY全文相等仍必收。finally证据立即保存，父FAIL与新普通房消费者范围分列，retained非fullsession。

```sh
node --import tsx tests/browser-contact-mine.mjs \
  --unreached-tail recovery/output/browser-contact-mine-2026-10-06T02-03-45-797Z.json
```

necessarytail已实际通过并亲审收；compiled23790冻结，无后续运行。

## 最终回链

主审 `recovery/output/contact-mine-root-review.json` / `PASS_FINITE_ORDINARY_BUY3002_KITBAG_SINGLE_CONTACT_DIRECT_HP300_ORIGINAL_CONSUMERS_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE`。网页审 `recovery/output/contact-mine-browser-root-review.json` / `PASS_FINITE_REFERENCED_ORDINARY_BUY3002_KITBAG_REMAINING19_CONTACT_DIRECT300_ORIGINAL_GROUND_ATTACHED_DRAW_ROLE_SOUND_DUAL_STATE_NATIVE_RESTART_SUMMARY_HOME_CLOSE_SCOPE`。专属wrapper `recovery/output/contact-mine-browser-accepted.json`。

actual25053/exit0 raw `recovery/output/browser-contact-mine-2026-10-06T02-08-40-962Z.json`：tail唯一ASSIGN19slot1、新房正常放置19消耗1→0、圆接触23.792436/direct300，peer750→450、owner650保持，旧20qty0与所有receipts全文保。425共同完整snapshot和各页自身tick玩家全文、原ground28/31实际draw、attached010/008正nodealpha、双SE02/SE31 playing/ended/空间gain、自然效果结束及Leave资源清零均收。双phaseLeave/HomeStrictClose、Runtime0、fullnative双四QUERY/同DB实际stopstart全文等；原生仅19消费与slot1变化及正常settlement+1/history+2，225280B/private0600/四清理/親三端口空。

首84789 FAIL及有限BUY20/放置20scope保持；tail19新房接触消费者与网络12365独立范围分列，不恢复旧session，retained非fullsession。原Func12/2 caller、Range80、像素/高清与全部内容父项仍开放。
