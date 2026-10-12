# Pet102 / 10711 模仿10811食物恢复

本线仅 `tests/browser-pet-copy-skill.mjs` 与本文，端口3665/5695/9895。正式政策与来源合同为 `pet-copy-skill-policy.md`、`pet-copy-food-source-contract.md`。合法source与oracle已由root冻结；本页分别记录既有有限范围与当前未运行的剩余端点。

具名候选已冻结为peer普通Pet103槽0base10811/rank1，原Trigger0/Func1 T65535、HPRegainRate20，唯一合格被动；host所选Pet102槽0base10711/rank1。10211非passive不采用，Critical/movement路线不采用。预服务学习Point由Numeric明确为非earned，页面不购买或学习宠物、不补资金/owned。

```sh
node --import tsx tests/browser-pet-copy-skill.mjs \
  --fixture recovery/output/pet-copy-skill-network-2026-10-06T01-30-57-474Z-identity.private.json \
  --database recovery/output/pet-copy-skill-network-2026-10-06T01-30-57-474Z-checkpoint.sqlite \
  --oracle recovery/output/pet-copy-skill-browser-oracle.json
```

oracle固定 `victimSkill={petId:103,slot:0,baseId:10811,rank:1,resolvedId:10811}`、`copiedFoodHealing=240`、`clearedFoodHealing=200`；最终冻结 `hostFrontBaseDamage=127.10765255670468`、`peerFrontBaseDamage=95.81218319769495`、`maximumAcceptedHits=64`（正常业务击毁/恢复预算，非概率矩阵）。每次实际伤害按同hit criticalbool×base与整数HP clamp确认，不预猜finalsource数值。

双方正常token/main导航，Home同时等待OwnedRoles与RoleProfile实际响应，从profile所选instance确认Pet102/10711、Pet103/10811槽0rank1与原popup。正常Shop Item选择小包item1，数量2/MONEY普通BUY扣20，新instanceqty2；正常Home Item页配置Kitbag4/hotkeys[3]，Digit5使用。最终source旧food预计0，购买必须使用正式新instance，不假定合并。

新普通map7/mode4双Create/Join/Ready，peer正常Arrow/soleSpace2001自然伤host缺口≥240并停射；host正常2001自然击毁peer，唯一候选10811在双selectedSkillIds实际新增。保持learner已有HP与弹匣/装填，不因复制重填。host普通Digit5消费一次，expected=min(240,maxHP−beforeHP)，准备要求初缺口≥240；停止peer射击后双itemUsed/skillId1/playerId=targetId=learner实际value、HP恢复、Inventory新qty2→1与完整samekey/网页ownconnectiontick players相等。

peer自然复活后正常击毁learner，双selectedSkillIds撤回10811、TankView.life(false)真实transition完成09。host自然完整HP复活仍无10811，再自然受伤缺口≥200，普通Digit5第二次恢复min(200,deficit)，余1→0；耗尽record可不存在。两次HPincrease仅沿现BattlePlayers.benefit→TankBenefitText.show正向只读消费者，同期heal事件不另enqueue，无新FX/声音/wire。

自然复活后的命中只沿真实瞄准与实际hit，不能假定spawn或远距无terrain阻挡；最终source路径需root/Numeric确认后freeze。实际有限shot预算由root明确，失败不追加概率/死亡矩阵。完整snapshot按room/round/phase/tick/serverTime双全文相等，网页逐页绑定该连接自身tick。

peer PLAYING Leave→host FINISHED summaryLeave，双普通Home StrictClose。普通双WsClient token Account认证四QUERY Inventory/Equipment/OwnedRoles/PetSkillLearning，native完整profilebytes/strings、库存、拥有记录、七hotkeys全文对应；正式新food BUY receipt等purchased、所有旧Shop receipts保持。disconnect后正常stop/start同tempDB冻结compiled，再双正常认证四QUERY全文相等。页面仅BUYfood2与Kitbag ASSIGN，不LEARN/EQUIP/funds/Point/CPU/RNG/截图。

finally保存原生命、Damage与Benefit只读调用、真实nativekeys/PlayerInput、事件及每页最多1000retained snapshot，backup/private0600与全部进程清理；不声明完整session。root独立工程覆盖候选排除/覆盖/无资格/新round等，页面首次范围仅具名复制食物240→自然生命清除后食物200与真实库存/持久闭合。原Func17 producer、主动条件复制、Effect12/SE12、高清及全部内容父项保持开放。

网络独立审 `recovery/output/pet-copy-skill-network-root-review.json`：`PASS_FINITE_ORDINARY_BUY_PET102_PET103_LEARN10711_COPY10811_FOOD200_240_DEATH_RESPAWN_CLEAR200_DUAL_STATE_NATIVE_RESTART_SCOPE`。网页fixture标记newPetBuyOrLearn=false、ordinaryFoodPurchase=true，准确区分食品正常BUY与既有Pet合法学习来源。compiled67626/原observer复用，当前无实际运行。

## 已收有限范围

首89140/exit1 raw `recovery/output/browser-pet-copy-skill-2026-10-06T01-37-01-075Z.json` 保持FAIL。审查 `recovery/output/pet-copy-skill-browser-first-root-review.json` / `ACCEPTED_FINITE_LEARNED_PET102_PET103_HOME_ORDINARY_FOOD_BUY_KITBAG_HOSTILE_COPY10811_FOOD240_DUAL_STATE_NATIVE_ONLY_CLEAR_CLOSE_RESTART_UNREACHED_SCOPE` 收Home、BUYfood18qty2/MONEY20、ASSIGN4、8真实accepted hits敌对复制10811、双itemUsed/skill1/value240、HP362→602及qty2→1。父购买requestId `570b3ac1-f8a0-4438-9c29-d955cb826340` 保持。

清除轮93398/exit1 raw `recovery/output/browser-pet-copy-skill-2026-10-06T01-42-56-039Z.json` 保持FAIL。审查 `recovery/output/pet-copy-skill-browser-clear-root-review.json` / `ACCEPTED_FINITE_HOSTILE_COPY10811_NATIVE_FINAL_DEATH_RESPAWN_CLEAR_DUAL_STATE_NATIVE_UNCHANGED_ONLY_TERRAIN_BLOCKED_FOOD200_CLOSE_RESTART_UNREACHED_SCOPE` 收11实际hit、双fullsamekey/webownTick、自然最终死亡及复活撤回10811、双life09→01。原生所有表保持、food18余1，0BUY/ASSIGN/食物消费。原复活后射线命中terrain，食物200与关闭/重启不在此范围。两轮各1000retained共同完整snapshot均非fullsession。

## 剩余食物200端点准备

入口严格核两份review的raw/status/checkpoint、首nativeExpectedEqual与清除轮nativeAllTablesUnchanged、余1库存、11hit、双死亡复活撤回、正式life09→01、Runtime0及cleanup。fixture/private与数据库仅沿最新01-42-56实际backup；`firstScope` 引用首Home/购买/配置/copy240，`clearScope` 单独引用93398死亡复活。此分支不购买、不ASSIGN、不再消费240、不重复复制击毁或死亡复活。

新普通房使用正常token/main导航、Create/Join/双Ready，不恢复旧session。双完整samekey/各页自身tick核起始host alive/fullHP且selectedSkillIds无10811。初始可射pair仅peer原aim/sole2001，实际FRONT伤害按criticalbool与整数HP确认，停止于缺口≥200且仍alive；全过程无10811。host唯一余1食物Digit5产生双itemUsed/skill1/playerId=targetId=learner/value200，HP实际+200，qty1→0，现Benefit正向消费者保留。此为清除后新房新生命的食物200范围，不称旧清除session消费。

原peer PLAYING Leave、host FINISHED summaryLeave、双Home StrictClose、完整native/cold四QUERY、同tempDB compiled stop/start双四QUERY全文相等保持。父真实购买receipt与所有retainedReceipts不变。finally保存observer/native输入与有限retained snapshots、backup/private0600及四清理。生产、types/build、截图和额外source均不在准备范围。

```sh
node --import tsx tests/browser-pet-copy-skill.mjs \
  --unreached-tail recovery/output/browser-pet-copy-skill-2026-10-06T01-42-56-039Z.json
```

最终剩余端点74092/exit0已有限收。compiled67626冻结；网络独立验收、首轮与清除轮有限范围、剩余端点新房范围分别保留，原producer/FX/高清及父全部内容gap保持开放。

## 最终回链

主审 `recovery/output/pet-copy-skill-root-review.json` / `PASS_FINITE_ORDINARY_BUY_PET102_PET103_LEARN10711_HOSTILE_COPY10811_FOOD200_240_PER_LIFE_CLEAR200_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE`。网页审 `recovery/output/pet-copy-skill-browser-root-review.json` / `PASS_FINITE_REFERENCED_LEARNED_PET102_PET103_COPY10811_FOOD240_DEATH_RESPAWN_CLEAR_NEW_LIFE_FOOD200_DUAL_STATE_NATIVE_RESTART_SUMMARY_HOME_CLOSE_SCOPE`。专属wrapper为 `recovery/output/pet-copy-skill-browser-accepted.json`。

剩余端点raw `recovery/output/browser-pet-copy-skill-2026-10-06T01-49-31-259Z.json`，actual74092/exit0：新房起始无10811、3真实hit、HP362→562、双200Benefit各一次、18库存1→0；0BUY/ASSIGN/copykill/death/240。421共同完整snapshot及各页自身tick玩家全文通过。原生全部表仅18库存−1及正常settlement+1/history+2，父receipt全文保持；完整native/cold四QUERY与同DB重启全文相等。双phaseLeave/HomeStrictClose、Runtime0、checkpoint212992B/private0600、四清理及亲三端口空均收。

三段网页scope分别属于普通新房，未恢复旧session；retained snapshot非fullsession。首与清除轮FAIL/raw/review保持，工程覆盖与网络持久验证独立列示。原Func17主动条件producer、Effect12/SE12、像素/高清及全部内容父项仍开放。
