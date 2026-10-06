# M2-01/M2-02/M2-03 弹药计算资格

`roles/recompute-ammo.ts`提供独立弹药计算入口。完整433466和独立入口共用技能累加、16/17限幅及装填转换函数；调用者须提供实际坦克定义、当前技能槽、实际已解析的其他技能来源和原限制表。接口不接收生命、宠物拥有记录或VIP标记，不生成拥有记录。

本片提供模块规则及专属正式网络验收。主线已发布独立magazineReady并接原装填/消费/补弹；空拥有资料的普通账户、CPU与VIP实际弹药范围通过。该范围不包含合法取得宠物/坦克拥有记录或完整默认配装。

## 直接确认的规则

| 来源 | 字段及消费者 | 本片执行 |
| --- | --- | --- |
| tank.dat完整loader43b62a，TankDelay列20/43b76d–43b785 | tank记录+8c，经43352f–43358e写role+50；TankBullet→tank+90→record+38 | 各车自己的原始参数，不硬填最终时长 |
| 4335b5–4337d7，432b29/432fe8 | 当前array getter4的16槽；独立role+a0的六组技能与等级；额外role+88/+8c及十个item来源 | 复用selectRoleSkills，baseId+rank−1；被动要求triggerType=0且前三函数存在type1/t=65535；排除当前槽重复，保留原item重复顺序 |
| 432951，4329fd–432a2d | skill Delay/LoadTime写role+50/+54；MaxBullet写record+38 | int32乘积后逐技能f32累加；type14使用getter9−FuncZ1正差倍率，其余为1 |
| 4337d7–433ad6 | datascale16/17 | Delay限制5～99，容量限制3～9；先上界后下界 |
| 433c55–433cf4 | role+50/+54转换，随后才处理VIP MaxHP | normal=f32(delay×f32(.1))；last=f32(未舍入的delay×f32(.1)×load×f32(.03)) |
| 423092，435499 | 发射前剩余弹量getter4，flag11及f32相对deadline | 仅剩余恰为1发选last；inclusive f32时刻判断；消费和补弹接线仍由ammo-magazine及主线actors负责 |

Delay原单位为十分之一秒，转换后秒。容量为整数发数。没有引入墙钟或坐标计算；原消费者以局内相对秒数比较deadline。tick固定delta、serverTime及客户端接收墙钟必须在实际对局验收分别记录。

原执行证据复用role-recompute-native.json、role-recompute-limits-native.json。原Windows客户端正常操作行为测量及误差本片没有取得，不把原x86函数执行当作客户端实测。安装普通2001到实际技能槽、初次满弹、成功开火后消费、末发deadline补弹及换弹不赠满仍为已登记的原服务端缺失重建规则，见tank-ammo-authority-sol.md。

## 正式来源分层与缺失入口

| 层级 | 已确认字段/链 | 缺失入口与影响 |
| --- | --- | --- |
| 原配置/公式已确认 | tank+84/+88/+8c/+90；pet+7c/+80/+84/+88；432951→433466限幅/精通/转换 | 本模块不重新调查；21车源定义直接使用 |
| 新账户正式创建 | Account→AccountStore.open，仅写accounts(id,token)；未建立role_records或role_profiles | 原服务端新账户角色配给/初值producer缺失；下一接线入口是账户建档及合法取得政策，不能用replaceRoleRecords验收夹具证明正式取得 |
| 正式购买/选择 | TankShop/PetShop写role_records；SelectRole写profile+a8/+a4；accountBattleBinding→selectedRoleSources→BattleRoleSources | 正价购买建档是明确重建；tank1/pet1零价取得资格仍缺；本模块不开放零价购买、不授予虚构拥有记录 |
| CPU创建 | World.manageCpu→manageRoomCpu→insertPlayer→createBattlePlayer；ownedRoles初始为空 | 无原CPU坦克/宠物/装备配给producer；实际tank定义及已装弹药技能可计算弹药，不因此推定宠物精通/生命/攻防来源完整 |
| VIP资格独立 | initializeModeRound→initializeBattleParticipants→recomputeBattleAttributes；完整VIP生命尾项独立于recomputeRoleAmmo | 主线magazineReady已发布；actors执行原装填/消费/补弹，生命倍率仍独立缺口；真实VIP证据见下表 |
| 数据存在但独立绑定未确认 | pet1四基础精通均3；10151驾驶四精通各+1且通过原被动资格；六技能ID/等级读boundGear+44..+58/+5c..+70 | 角色+a0写入producer仍缺；422f66/3aa5仅写manager+20/+24，4264c4只绑定record+2a0和定义+2a4/+2a8，4227d8/4335b5读取+a0；下一待查入口为正常选pet/开局实际caller给角色+a0赋值。该缺口已两次无进展，暂停同类扫描；不得把selected pet记录直接传boundGear |
| 字段消费者已证、初值未追完 | owned tank+34=0时四精通减1最低1；433ad6–433c55 | TankShop当前写0是重建购入政策；原购买建档或消息producer尚缺，不能称原版默认。不因此给全车默认+10速度/+4度转速 |
| 控制重建 | A/D→turnStationaryRolePose；方向键→aimTurnRate，以恢复role turn rate驱动独立炮塔 | 原独立键盘炮塔caller未取得；当前控制映射是重建，见tank-numeric-network-browser.md，不更改按键 |

运动依赖坦克/实际有效精通/合成移动转向/owned+34；弹药依赖TankDelay/TankBullet和实际生效技能；攻防依赖自身原字段和精通；生命依赖owned base+2c及实际MaxHP技能，VIP尾项独立。完整HP重算不可成为已确认弹药规则的统一门禁。缺失技能来源须单独披露，不把仅基础来源结果称为完整默认配装。

## 本片检查及集成建议

`tests/tank-ammo-qualification.cts`对照现有原x86完整重算结果：563完整弹药向量，其中376 VIP向量逐值一致；array缺失向量返回undefined。21实际tank定义在明确仅2001/4020技能来源条件下通过，时长依各自TankDelay变化；这不证明全部宠物、装备及+34组合。

共用函数抽取可能影响原全字段及通知时序，因此执行受影响的原完整重算564向量、缺失来源254组合与限幅转换758向量；全部通过。未重执行原EXE、不重跑无改动的网页/图声/账户重启/五模式。类型检查通过。

证据：tank-ammo-qualification.json及同名前缀的.log、-full.log、-limits.log、-types.log。命令：

```sh
npx tsx tests/tank-ammo-qualification.cts
npx tsx recovery/evidence/attributes/role-recompute.cts
npx tsx recovery/evidence/attributes/role-recompute-limits.cts
npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop tests/tank-ammo-qualification.cts
```

主线集成：安装所选弹药真实技能后，以实际可得的技能来源调用recomputeRoleAmmo；成功时发布record+38、role+50/+54与独立弹药资格，并初始化普通弹匣；actors依据该资格执行空弹门禁、原装填通知和消费。完整来源路径仍执行原433466。独立路径不得假设缺失pet技能已生效；实际装备/绑定来源到达时须同一selector重算。重算、切换及局生命周期不能赠满旧普通弹匣。

M2-01保留生命/攻防来源范围，M2-03保留宠物有效精通及正常取得路径缺口，不勾父项。小勇士完整链仍须普通Account合法取得/选择/实际技能与键盘或CPU输入及双端同步，之后沿同链补其他车型。原完整伤害公式仍缺，显示Atk不可直接当伤害。

## 已通过的无拥有夹具正式弹药范围

索引tank-ammo-player-accepted.json分别接受普通mode4与VIP mode3实际通过记录；两次原始FAIL保留。测试只创建隔离空数据库并调用Account API，不写账户profile、余额、库存或拥有记录。所有活跃状态由正式输入与服务器推进，未注入位置/伤害/事件/胜负。

| 范围 | 实际路径及证据 | 实测 |
| --- | --- | --- |
| 普通账户/CPU | mode4，Account空拥有→正常请求tank1建房/加入→CPU ADD→Ready→普通fire；mode4-2026-10-04T15-41-35-951Z.json | 普通玩家7次、CPU6次真实开火；玩家6→0、停火补6、再发至5；272共同tick完整players一致 |
| VIP身份 | mode3四正常Account、合法4人/0007、正常Ready；mode3-2026-10-04T15-44-15-263Z.json | host权威isVIP=true，容量6与normal1.7000000476837158/last5.099999904632568和普通相同；6→0→6→5；274共同tick完整players一致 |
| 时间记录 | 每快照tick/serverTime及接收wallTime，发射startedAt独立 | 普通五间隔server1.719～1.746秒、VIP1.711～1.720秒；末发后停火补弹server5.114/5.103秒；与各自f32 deadline及下一服务tick一致。模拟tick固定50ms，墙钟不冒充模拟时间 |

补弹由主线将advanceDefaultAmmoMagazine的完整属性dirty门禁改为必传独立magazineReady；不清其他属性dirty。普通与VIP此次均通过，代码接线归属仍为主线。普通2001技能安装/消费/补弹政策继续明确重建；数值累加/限幅/转换来源为原执行。

Runner为tests/tank-ammo-player-network.cts，命令`npx tsx tests/tank-ammo-player-network.cts 4`与`... 3`，严格独立类型输出tank-ammo-player-network-types.log。服务与临时数据库均清理，双端正常Leave已验；未改保存格式，不运行重启。

M2-02原位登记建议改为“独立弹药资格已正式接线；无拥有夹具普通Account/CPU/VIP真实消费、末发补弹和双连接一致通过，索引tank-ammo-player-accepted.json”。本片不证明新账户取得/选择阿呆与小勇士的拥有记录、10151完整生效、特殊弹库存取得/换回或其他20车型真实联机；这些仍保留父项未完成。

## 无拥有来源的复活与再战

tests/tank-ammo-player-lifecycle-network.cts通过真实空Account、mode4/0007普通Ready、CPU普通自主射击与两人正常Rematch投票验证：guest先用普通fire消费6→5；CPU自然命中至死亡；原出生点自然复活后默认2001/6发容量与剩余恢复；自然时间结算后投票直接开第二局，全部三角色2001/6发、reload startedAt=0；guest保留递增普通输入sequence开火至5、原1.7000000476837158秒装填；正常双端Leave成功。

实际证据tank-ammo-player-lifecycle-2026-10-04T15-51-13-166Z.json/.log整体PASS，690共同room/round/tick/phase的完整players一致。复活间隔实际server3.002秒、接收wall3秒、快照模拟tick2.95秒分别记录；以服务端3秒deadline为准，不能把快照模拟步数当墙钟。原rawFAIL记录15-49-35-397Z保留；父项仍未完成。命令`npx tsx tests/tank-ammo-player-lifecycle-network.cts`，独立严格类型日志tank-ammo-player-lifecycle-types.log。

这证明新Account未拥有pet/tank记录路径上的实际普通弹药复活/再战政策，不能证明原购入初值、原服务端复活配给或完整默认宠物配装。原status2自身不重置ammo，resetConfirmedAmmo→resetAmmoMagazine及computed初次满弹仍为明确重建。已有特殊弹换回夹具证据不因此升级成普通取得路径。

## M2-02 新Account真实购买与部分普通弹匣切回首验

`tests/tank-ammo-purchased-switch-network.cts`与raw `tank-ammo-purchased-switch-network-2026-10-04T16-25-39-244Z.json`通过，严格类型通过。两个Account由正常API创建，初始拥有/库存均空。射手仅profile明确100000测试资金，其余字节0/两空字符串；TankShop BUY tank3游骑兵2500→SelectRole实际实例→Shop BUY2007数量1花10→Kitbag普通槽1，余额97490。没有pet拥有/选择，没有导入tank或inventory。mode4/map7普通Create/Join/Ready与PlayerInput执行，实际tank3来源一致。

普通2001实际技能2001/4020、tank3及装备+58/+5c/+60，经统一累加/限幅/f32规则得到容量7、普通1.5秒、末发4.5秒；2007实际技能2007/4005得容量5、普通2.1000001430511475秒、末发6.300000190734863秒。装备购入+34=0仍为重建初值，原购入语义未知；缺pet不阻独立弹药资格，不代表运动/生命已充分。

实际普通7→6，特殊库存1→0与弹匣0/5，耗尽拒绝退回2001仍6/7；持有被拒的输入40tick不新增开火（总2次），fresh普通输入→5/7。持久AccountStore库存ownedQuantity/battleQuantity均0，双端198共同tick全部players及fire/ammoConsumed/itemRejected事件一致，双方正常Leave并清临时服务/数据库。

| 阶段 | tick | 模拟秒(tick×.05) | 服务端ms | 接收墙钟ms |
| --- | ---: | ---: | ---: | ---: |
| 普通消费6/7 | 2 | 0.10 | 1791131141605 | 1791131141611 |
| 特殊消费0/5 | 33 | 1.65 | 1791131143177 | 1791131143181 |
| 耗尽切回6/7 | 157 | 7.85 | 1791131149433 | 1791131149441 |
| 新普通输入5/7 | 198 | 9.90 | 1791131151492 | 1791131151511 |

以上为采样阶段时间，消费special与服务器deadline可以早于采样tick；本片只确认实际装填duration与部分弹匣保留，不宣称末发精确墙钟时长/firsteligible tick性能。显式手动切回未耗尽特殊弹、其他购入组合与原Windows行为仍保留。

具体入场缺口：Account profile存在时，`accounts/battle-binding.ts roomTankId`读profile+a8并由ownedTank校验实际equipment实例；只有资金profile且+a8=0时正式CreateRoom拒绝，raw16-24-05保留。本片通过真实TankShop BUY→SelectRole提供该字段，未补starter；原新账户profile/资金与零价tank1/pet1取得producer仍缺。原消费者433ad6读owned+34的精通条件语义及原购入写入口未完成，role+a0绑定写入口按既有停止条件保留。

索引`tank-ammo-player-accepted.json`新增purchasedPartialSwitch仅此范围；M2-02父项保持未勾。没有复跑已过native、其他21车型弹药、五模式、账户重启或稀疏local检查。

## M2-02 未耗尽特殊弹主动切回首验

`tests/tank-ammo-purchased-manual-switch-network.cts`与raw `tank-ammo-purchased-manual-switch-network-2026-10-04T16-29-15-107Z.json`PASS，strict类型PASS。正式新Account起点零拥有/零库存，仅明确100000资金profile；tank3与2007数量1均实际BUY，真实SelectRole/Kitbag，未取得pet或导入拥有库存。源规则复用既有同tank3实际装备/current skills统一容量7/普通1.5/末发4.5及2007容量5/普通2.100000143/末发6.3000001907。

普通7→6后选尚未消费的2007为1/5，主动useItem1回普通6/7且库存仍1；重新useItem2选2007仍1/5，实际射出后库存0/弹匣0/5，主动回普通6/7。正在进行的特殊末发装填duration保持6.300000190734863且remaining>0，没有通过切回重置或绕过装填；倒计时到0仍6/7，新普通输入后5/7及duration1.5。全程只3fire、1ammoConsumed、0itemRejected，持久owned/battle库存0。

两连接156共同tick的全部players与相关事件相同，正常Leave/服务临时目录清理。普通协议useItem路径为现有键盘槽映射消费者，不称本片网页键盘操作；确认selection/install/finite consumption/初始化为已登记重建服务端规则，原请求门禁/公式来源按既有证据区分。

| 阶段 | tick | 固定模拟秒(tick×.05) | 服务端ms | 接收墙钟ms |
| --- | ---: | ---: | ---: | ---: |
| 普通消费6/7 | 2 | 0.10 | 1791131358229 | 1791131358267 |
| 选未耗尽特殊1/5 | 3 | 0.15 | 1791131358280 | 1791131358294 |
| 主动回普通6/7 | 4 | 0.20 | 1791131358331 | 1791131358335 |
| 重新选特殊1/5 | 5 | 0.25 | 1791131358380 | 1791131358384 |
| 特殊消费0/5 | 33 | 1.65 | 1791131359842 | 1791131359855 |
| 主动回普通保留装填 | 34 | 1.70 | 1791131359893 | 1791131359904 |
| 原装填结束仍6/7 | 155 | 7.75 | 1791131366103 | 1791131366113 |
| 新普通输入5/7 | 156 | 7.80 | 1791131366153 | 1791131366174 |

固定模拟tick来源`runtime/tick.ts`的1000/tickRate传参，角色装填倒计时另取既有服务端角色时间，不把采样tick秒或墙钟等同精确原时基。原Windows客户端行为测量、其他特殊弹及所有配装范围未完成；购买+34初值/原pet绑定缺口未改。本片不重跑已过自动耗尽、原native、运动、五模式或账户重启。索引purchasedManualSwitch范围仅以上，父项保持未勾。

## M2-02 第二实际弹种2011主动切回首验

`tank-ammo11-purchased-manual-switch-network-2026-10-04T17-07-29-121Z.json`PASS，专属`tests/tank-ammo11-purchased-manual-switch-network.cts`focused strict NodeNext类型PASS。真实新Account零拥有/库存，仅资金profile100000测试夹具→tank3 BUY2500/Select→2011 BUY1原MONEY50/Kitbag，余额97450；不取得pet、不导入拥有库存、不假技能绑定。实际2001/4020与2011/4009分别安装，原tank3同规则两者容量7、普通1.5秒、末发4.5秒。没有沿用2007的容量5/6.3秒。

普通7→6→2011未耗1/7，手动slot1回普通6/7且库存1；重选slot2仍1/7，真实消费0/7，主动回普通6/7保留已进行的4.5秒末发装填，结束仍6/7，新普通开火5/7。3fire/1ammoConsumed/0itemRejected，持久owned/battle库存0，两端123共同tick全players及相关事件一致，双方普通Leave/cleanup。

| 阶段 | tick | 固定模拟秒 | 服务端ms | 接收墙钟ms |
| --- | ---: | ---: | ---: | ---: |
| 普通6/7 | 2 | 0.10 | 1791133650566 | 1791133650572 |
| 选2011未耗1/7 | 3 | 0.15 | 1791133650616 | 1791133650633 |
| 主动回普通6/7 | 4 | 0.20 | 1791133650667 | 1791133650674 |
| 重选2011 | 5 | 0.25 | 1791133650717 | 1791133650735 |
| 实际2011消费0 | 32 | 1.60 | 1791133652077 | 1791133652119 |
| 回普通保留末装填 | 33 | 1.65 | 1791133652127 | 1791133652142 |
| 装填结束 | 122 | 6.10 | 1791133656603 | 1791133656625 |
| 普通5/7 | 123 | 6.15 | 1791133656653 | 1791133656666 |

三时基为独立采样，不宣firsteligible或精确墙钟性能。选择确认/安装/有限消费/部分普通弹匣保存仍为已登记服务端重建政策；原2011特效/伤害/两局/重启引用既有独立范围，不在本片复跑或扩大声明。此首验补旧拥有fixture无法证明的新Account真实BUY源，父M2继续未勾。

实际部件取得与装配已接：Shop追加原8～12类别74个双正价定义，正式BUY创建归属inventory实例，Equipment校验数量/state并保存profile+148五实例；resolveBattlePartTableIds将state2有效实例转换为role数组2(+bc起)真实ItemTableID，原43372d–43376b/432fe8选择被动技能。真实15001、15012、15021消费者证据见tank-purchased-part-{ammo,capacity,fastload}-network.md，范围各自独立，不以目录74项宣全配装。原42762e发3abb只能证明已有instance装备请求；原server出售授权/成功建档和库存writer仍缺，当前BUY/CAS及TankPartSlot→新购owned+6c是明确重建政策，不以fixture或客户端空构造代原producer。
