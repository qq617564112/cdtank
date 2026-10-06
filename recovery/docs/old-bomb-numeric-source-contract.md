# 古老炸弹3001数值与普通业务来源

M4-10/FUNC-13/FUNC-15/FUNC-02的具名未接玩家业务。现有来源为已发布 `recovery/output/web-assets/combat-catalog.json` 的原item/skill字段；原表现接收入口复用 `old-bomb-presentation-entry.md`、`skill-bomb-entry-source.md`，不重复native或绘制检查。

## 普通取得与输入

原item3001“古老炸弹”正价MONEY20/TOKENS20，GetMethod2、Durable10、BreakMode2、Icon3001、ItemType4、每局BattleUseMax10，skillIds=[3001,0,0]。原文案为放置一段时间后爆炸。原class4的3001在Inventory归primary，仅可配置Kitbag槽1–3；对应战斗键2–4。class4已由正式 `apps/shared/combat/item-hotkeys.ts` 正常快捷槽输入映射为placeTrap(instanceId)，已有Kitbag持久配置及库存接口可供普通操作；不构造拥有夹具。

正式root `battle/items/old-bomb.ts` 已读具名数值引用，已接入3001商城、groundTraps定时放置、直接生命作用与公开3001对象联合；数值线不修改这些共享文件。现RoomState已有groundTraps，正式呈现归属由root/FX接线，普通取得与槽位配置已实达，定时消费尚未实达。已收Pet4网络账户余额66460及peer90500足够原购价，不需要新资金或拥有记录。

## 原数值引用链

| 记录 | 直接来源 |
| --- | --- |
| skill3001 古老炸弹 | Trigger1/Target1/Range0；Func13 T5/X30/Y3009/Z3001；Info需放置一段时间后起爆 |
| skill3009 大型爆炸 | Trigger1/Target4/Range200；Func15 T0/X0/Y3012/Z0；Info约200×200范围爆炸、HP-300；自身attributes.HP=0 |
| skill3012 大型爆炸伤害 | Trigger1/Target1/Range0；Func2 T0/X0/Y0/Z0；实际attributes.HP=-300 |

3001→3009→3012是两个具名Y引用；固定HP=-300来自末端3012，不能把3009自身零HP当作无伤害，也不能仅用Info代替数值字段。T5、X30、Range200各自保留，不将X30当爆炸伤害或把Range200默认为半径。现3012也被空袭3013引用，本片不扩空袭Func16/X20来源与政策。

skill3001首效果10/SE02/tag0/method3；3009首效果9/SE32/tag0/method1；3012效果声音全0。效果字段及已证世界receiver只确认条件显示入口，不能证明原放置、计时、目标调用或sender。原Func13/Func15执行器、T与X单位、原地面对象工厂及爆炸生命writer仍缺；不由字段猜新增效果、通知或爆炸模型。

## 新消费者缺口

玩家终点为普通BUY3001→Kitbag配置→placeTrap请求→持久CAS成功后扣一次有限库存并生成归属对象→权威计时触发具名3009/3012生命作用→目标生命、击毁与双端事件状态一致→对象释放、普通Leave及同库库存恢复。该消费者是定时地面范围伤害，区别于既有接触束缚陷阱，不复验原flag9/10/11矩阵。

## 正式Web政策与纯计算

`old-bomb-policy.md` 已采用T5→5000server毫秒、3009Range200→200×200轴对齐方形，abs(dx/dz)≤100闭边界；3012 HP=-300作为直接生命减量，不走shot Critical/facet/饮料防御/counter/drain，不生成shotPlayerResult。敌对非self、mode≤3友方排除、alive/status2、现无敌拒绝由root生命consumer处理，X30用途未证不参与公式。放置成功持久CAS先扣数量，到期前不因接触触发，到期移除对象后一次爆炸；owner自然死亡仍计时，Leave/FINISHED/newround清对象不退款，扫把保持原skill12.range400并支持3001。最终生命、击毁、得分及10441阶段沿统一生命周期。以上单位、几何及组合是Web重建，原执行器及X30缺口保留。

数值canonical `roles/old-bomb-blast-rule.ts`：`readOldBombBlastNumbers(delaySeconds,range,hpDelta)`仅换算{delayMs:seconds*1000,halfExtent:range/2,damage:-hpDelta}；`isInsideOldBombBlast(dx,dz,fullExtent)`按两轴abs≤fullExtent/2。caller负责合法源与目标资格，pure不读账户、时钟、target或X30。`tests/old-bomb-blast-rule.cts`唯一actualexit0，源5/200/-300→5000/100/300、四边四角包含、刚越界排除，输出 `recovery/output/old-bomb-blast-rule.json`。原几何未恢复，不把方形角落可命中称原测量结果。

## 普通网络首次准备

`tests/old-bomb-network.cts` 预留3662，网页3663/5693/9893由主线协调。合法源复用Pet4网络00-33-10实际checkpoint/private，本人余额66460/peer90500，Point0；不写资金、Point、拥有或活跃HP/位置。普通Shop BUY3001×2花40，真实Kitbag ASSIGNslot1/hotkeys[0]（保留其它源槽，原3003配置被正常替换而其库存保持），原PlayerInput useItem2放置一枚。独立expectedHotkeys由before的完整七槽仅替换index0，新assignment、QUERY及final全文相等；PLAYING实际Inventory/hotkeys经原resolveItemHotkey(2)必须得到placeTrap(instanceId)，不借生产放置结果掩盖错误请求。其余原owned/profile字段保持，购入未具名的field8/float字段沿正式Shop重建输出，不声称原版默认。

普通A/D把本人车体朝向peer、普通前進使方形内的目标位置足够留边界余量，停输入后原实际当前位置生成对象；完整原source重算同时确认双方生命与所选Pet4/Pet2资格。对象3001/model3001 owner/point与放置play首槽roleId0/xz floatbits同源，数量2→1；到期前所有已捕获状态无伤害，到≥5s仅一次3009通知、一个3012 hit300/peerHP700→400、selfHP650保持且不产生shotPlayerResult或额外heal。三时基、完整同room/round/phase/tick/serverTime快照及业务事件逐值双同。

双方普通Leave后四QUERY完整保持，仅本人购价、Kitbagslot1与新3001qty1变化；完整原生两profile/inventory/owned、两hotkeys及新Shop完整receipt，然后实际disconnect/stop/start同一路径双认证四QUERY全文等终点。finally checkpoint/private0600/临时库及服务清理，为网页保余1合法源。现两账户无原已拥有扫把12，不新BUY扫把或第二枚清扫矩阵；self/friendly/immune、owner死亡/Leave/finish/sweep等由root工程覆盖，普通网络不冒全部分支。

专属finaltargettypes实际exit0，compiled42889。唯一首轮session54290实际exit1，raw `recovery/output/old-bomb-network-2026-10-06T00-56-06-704Z.json` 保留。普通BUY×2、Kitbag1完整七槽与PLAYING快捷请求资格已达；普通前进等待距离≤75在5000ms超时，最后实际距离约82.27。两端各172帧、事件0、阶段0，放置、定时爆炸、普通Leave、原生断言及同库重启未达。finally已断连停服、保存212992B checkpoint与private均0600、删除临时目录，3662亲核为空；合法新库存仍为2。本片尚无普通定时消费PASS，原Func13/15/2 producer、X30/全部技能与父范围仍开放。

首轮有限审 `old-bomb-network-first-root-review.json` 收普通取得、配置、原生完整保存及前进输入；不收放置消费。`OLD_BOMB_TAIL=1` 必须沿首轮checkpoint/private并核该评审、FAIL/空phases/空events/BUY2/Kitbag1，双认证四QUERY全文等first.assigned。复用首purchase/assignment，跳过BUY与ASSIGN，无Point/资金/owned写入；新普通房重新完整source资格，保留≤75距离与两轴<90，仅把前进等待设8000ms并finally正常停止输入。终点仍按first.before仅扣40、完整七热键、新数量1及原receipt；放置、5s爆炸、Leave/native及真正同库重启均待明确尾段窗口。

唯一必要尾段session13135实际exit1，raw `old-bomb-network-2026-10-06T00-58-59-539Z.json`；尾段targettypes实际0。完整parentassigned与原source已核，0重复事务。8000ms仍未达≤75，末位置与首轮一致，两端各231帧、事件0；具体停止原因未核。finally普通停止输入、断连停服、保存212992B checkpoint/private0600并删除临时目录，3662为空。两原FAIL保留，库存余2；定时消费、Leave/native断言与重启未达，无第三次运行。

尾段有限审 `old-bomb-network-tail-root-review.json` / `ACCEPTED_FINITE_ORDINARY_BUY3001_KITBAG_SOURCE_NATIVE_UNCHANGED_MOVE_PLATEAU_ONLY_BLAST_UNREACHED_SCOPE` 接受首轮购买配置源、尾段初始完整四QUERY与原生全部表保持、231共同完整快照及移动plateau。两FAIL与未放置/未爆炸范围独立保留；原75网络路线停止。正式UI沿真实余2源、合法core100与正常BUY1补计时消费及同库冷恢复，main/browser仍pending。

网页未达有限索引：`old-bomb-browser-first-root-review.json` 收observer语法失败前合法源完整保持；`old-bomb-browser-category-root-review.json` 收普通Shop QUERY含3001及原生保持，未BUY/ASSIGN/place。正式sourceShopItemCategory把class4的3001列入Weapon，驱动Item分类无法出现商品行；该分类边界为仪器原因，不需改变生产购入或伤害门禁。两网页原FAIL保持，main/browser及五秒业务仍pending。

网页普通购买有限审 `old-bomb-browser-purchase-root-review.json` / `ACCEPTED_FINITE_ORDINARY_WEAPON_SHOP_BUY3001_NEW_INSTANCE_NATIVE_RECEIPT_ONLY_KITBAG_BLAST_UNREACHED_SCOPE` 已核正常Weapon购买20：66420→66400，旧实例14余2完整保持，新receipt实例15数量1；不能称同品堆叠为原实例14数量3。原生完整预期与新receipt已核、0房/0事件/Runtime0，配置、放置、爆炸、Close及本网页同库重启未达。此后实际源为该购买checkpoint，必要未达尾应复用该交易。所有原FAIL和完整父范围保持。

## 已收有限正式闭环

mainReview `old-bomb-root-review.json` / `PASS_FINITE_ORDINARY_BUY3001_KITBAG_FIVE_SECOND_DIRECT_HP300_ORIGINAL_CONSUMERS_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE`，browserRootReview `old-bomb-browser-root-review.json` / `PASS_FINITE_ORDINARY_BUY3001_KITBAG_TIMED_DIRECT300_ORIGINAL_GROUND_WORLD_DRAW_DUAL_STATE_NATIVE_RESTART_SUMMARY_HOME_CLOSE_SCOPE`。父轮45229普通Weapon购买实例15数量1/20与尾段2928仅正常ASSIGN15slot1、原生Digit2消费分列；旧14数量2全文保持、新15归0，总库存3→2。普通方形内目标到期前HP不变，五秒后唯一3009及3012 hit300/HP700→400，无shotPlayerResult；369共同完整snapshot及网页各自身tick玩家一致。原03001与world010/009实际nodehandle/vertexalpha绘制、静默树、对象及退出资源清理通过。双普通Leave/StrictClose、完整native/profile/inventory/owned/hotkeys与receipt、同库真实停启双四QUERY保持；正常settlement+1/history+2，其他业务表完整保持。

两个专属网络原FAIL仍仅first/tail有限review范围，不改为PASS；网页observer、category与purchase原FAIL保持分列。原Func13/15/2 producer、X30、像素/HD及全部21车型和相关业务父范围继续开放。
