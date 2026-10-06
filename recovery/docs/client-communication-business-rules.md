# 客户端通信规则与服务端业务

缺失原服务端程序时，服务端业务按客户端请求、接收回调、确认字段和原表参数还原。直接恢复的字段及消费者保留原来源；请求中没有目标或数值的业务由服务端从认证角色、拥有记录和原表计算。客户端未知包字段不赋予未经证实的含义。

普通使用43d4dc的存活status2、实例查找及本局数量门禁提供请求前置条件；3c9e只发请求，3c92独立确认扣量。当前服务端据此采用成功事务先保存、再改变本局数量与角色状态的顺序。重发普通输入由既有sequence门禁拒绝，失败保持库存与角色状态。是否成功由服务端完成作用及保存决定。

## 光学迷彩

对应M4-10-I09、FUNC-07及M6-06。原物件9关联skill9、BattleUseMax=2；技能Target1、TriggerType1、FuncType7、T10且Effect/Sound均为0。普通使用请求没有可确认的目标或持续时间字段，服务端按请求者自用和原表10秒执行，不从客户端接收生命、期限、技能或效果参数。

服务端从确认拥有实例消费一份，在16槽技能数组中加入临时skill9，发送`PlayerSnapshot.opticalCamouflage={skillId:9, expiresAt}`。到期、死亡、结束及新局删除这项状态和本次临时技能；拒绝重复或技能槽满时不消费。持久保存沿既有CAS，CPU库存沿当前临时配给，均只经普通输入施放。

观察规则由`isHiddenByOpticalCamouflage`统一：存活的隐身角色对敌对观察者隐藏；本机可见，团队模式队友可见，混战/破坏的其他参与者均视为敌对。CPU停止选择隐藏角色作为目标，网页战车root隐藏但保留姿态与动画生命周期。碰撞和手动弹丸命中继续有效，开火不取消隐身。零Effect/Sound不产生额外绘声。

上述自用、成功确认、非叠加、生命周期与观察规则是按客户端通信和表参数补全的服务端业务。原43535e/43538e已确认的存活与队伍判断、原技能添加/删除及实例数量消费者提供边界；原Func7到actor的实际字段和原controller完整配置未找到，观察规则不宣称为已执行对照的原Windows分支。

光学迷彩的原两种价格与GGet均为0。使用链从确认已拥有实例或操作员配置的有限CPU库存开始，正式商城不开放其免费购买。

## 建筑工具

对应M4-10-I502及FUNC-18。原物件502关联skill502、BattleUseMax=2；技能Target1、TriggerType1、FuncType18、X2、Y5000、Range0，首槽Effect12/SE13。物件说明写1000，技能说明与函数参数写5000；当前业务采用函数参数5000，恢复量限于实际Castle的生命缺口。

普通请求只有拥有实例，没有碉堡目标或恢复值。服务端从请求者队伍查找当前房间的本队Castle，不添加距离条件或客户端目标参数。目标必须对应原SYcCastle放置及源型号；CAS尾段+4提供初始生命，+8附加字段在已接地图中为1/2。将附加字段1/2映射到当前team0/1是采用的业务规则。仅mode1的存活受损Castle可恢复，满生命、已摧毁、无本队目标或错误模式拒绝不消费，Breach和占领目标不参与。

成功沿既有CAS先保存库存，再扣本局数量并恢复Castle。`sceneObjectHealed`携带原有Castle事务字段，delta为实际恢复量的负值；客户端据此恢复稳态动作并清除失效的持续损伤绘声，不播放命中或坍塌。skill502的首槽绘声仍按Target1挂在使用者。CPU仅从已配置的有限物件502发普通输入，不写入目标生命或库存。原零价不开放免费购买。

本队映射、受损且存活资格、无距离自用、本次恢复量、消费时序与修复事件是依据请求、Castle字段和表参数采用的规则；原Func18目标查询和服务端恢复入口尚未找到，原客户端修复后的完整显示分支未经执行对照。

## 南瓜与木桶伪装

对应FUNC-08和M4-10的I10/I11。原物件10/11分别关联skill10/11，每局上限5，Target1、TriggerType1、Range0、FuncType8、T10、X1/2；首槽Effect3/GA16。原4173接收roleId32和style8，style1选择obj05428南瓜、style2选择obj05422木桶，隐藏战车并按角色创建时XYZ生成替身；4174按roleId恢复战车并删除同角色替身。原消费者没有本机/队友/敌对显示区别；这些是直接来源事实。

原Func8 server producer、成功消费因果、T期限writer、目标权限及开火恢复条件未恢复。当前服务端采用请求者自用、成功CAS后扣量、临时技能与T10=10秒权威期限；两种伪装互不叠加并与光学迷彩互斥，已有效果或技能槽满时拒绝不消费。`PlayerSnapshot.roleDisguise`保存skillId、style、startedAt、expiresAt和施放XYZ，替身固定在施放位置，不声称原消费者后续跟随。

`MsgRoomEvent.roleStyleChanged`/`roleStyleRestored`携带原显示身份；共享schema手工附加version93、property41及event20/21，未执行生成器。`Battle`已显式转发两事件；普通输入产生伪装状态变更时先广播权威快照再发送事件，真实发射边界在`fireProjectile`后按当时仍有效的`roleDisguise`恢复，批末不再扫描旧`fire`撤销后续合法施放；普通选弹不恢复，原flag12清理不等同模型恢复。

普通开火只有在弹匣、装填和库存消费门禁均通过后才恢复伪装；被拒绝的开火保留状态。到期、死亡、复活、终局、新局和离房移除本次临时技能与替身；恢复不清除其它单次绘声。施放只沿skill10/11首槽原Effect3/GA16，恢复不额外补造绘声。角色碰撞、手动命中、伤害图片及CPU目标身份沿既有规则。

物件10/11零价/GGet0不开放免费取得。玩家从已有归属库存使用；CPU仅使用房主在槽5–8配置的有限库存，存活、近敌、低生命且当前无开火机会时发普通伪装输入。CPU在伪装期间保留普通移动与转向、暂缓主动开火，期限结束后继续原决策；该策略为采用的AI规则，不是原服务端事实。

本批一次集中gpt-5.6代码走查已执行，修复真实发射边界恢复与普通输入快照先于事件发送两项；实际双端施放/恢复、自然到期、合法与被拒开火、死亡/再战、高清、账户库存保存及真实重启仍待验收。FUNC-08及M4-10-I10/I11保持未完成。

## 空袭

对应FUNC-16/FUNC-15及M4-10-I13、M6-06-I13。原物件13“救命啊”通讯器关联skill13，每局上限1，两个正价40金币/20软星币，GGet2；skill13为Trigger1/Target1/Range200、FuncType16 T0/X20/Y3013/Z0、首槽Effect10/SE02/Tag0/Method3。skill3013为Target4/Range200、FuncType15 T0/X0/Y3012/Z0、首槽Effect60/SE32/Tag0/Method1；3012为FuncType2 HP-300且无效果/声音。原表引用链 `item13 ItemSkill1 -> skill13 Func16 -> skill3013 Func15 -> skill3012` 及表loader槽步长是直接来源；原416f接收器486a09只消费消息+c技能、+10效果槽和+14 float32 XZ点数组，经向零截断提交world采样Y=0，不读FuncType、不扣库存、不写目标生命。

原416f sender及点vector位置/数量来源、Func16/15权威分派、3013→3012实际调用、3012 HP writer及X20单位/数量/调度未恢复。当前服务端按客户端请求、接收确认和原表参数采用：正式商城Item分类按原价开放普通QUERY/BUY，不因GGet2免费，不预置库存；Home配置槽5–8、战斗普通输入5–8；请求只带拥有实例，服务端以请求者权威角色XYZ为爆发中心（XZ用于范围选择，事件携带XYZ）。成功时先账户CAS持久扣量，再扣本局量并发布一次`itemUsed`；`resolvesAt=now+20*实际configured tickMs`，表示20个服务器tick且一次结算，不解释成20次/20发/20波。到期对center做一次skill3013的200×200闭方形范围选择（`abs(dx)<=100 && abs(dz)<=100`），合法目标为同房、alive、status2、非施放者且mode<=3时非同队，随后对每个目标调用一次skill3012 direct HP-300，走统一死亡/mode结算和免伤链，不生成`shotPlayerResult`。

表现复用既有`playSkillEffect`事件与roleId0世界分支：skill13 Effect10和skill3013 Effect60均已发布，消费者按`_root\online\{effectId:03d}`和`[worldX,0,worldZ]`启动世界树。原raw世界通知handler不播放技能声音；UI采用业务政策在正式`itemUsed`/`airstrikeImpact`事件中按原first-slot soundId各接一次空间WAV，`roleId0`世界树自身的空声音容器保持原静默边界，不泛改raw世界通知。`MsgRoomEvent.type`仍是普通string字段，不新增schema union/effect字段，也不改生成器。

施放本身在CAS成功后即消费，命中/未命中均不退款；施放者自然死亡不取消已排定轰炸，离房只删本人ownerId在途记录，终局/新局清空且不重放历史伤害。CPU只从房主已配置的有限item13库存沿普通快捷输入申请，不直接写库存、不赠送、也不扩item12/501策略。以上购买、配置、消费、中心、范围、伤害、寿命及CPU资格均为采用规则；原server来源缺口、全部FUNC-15/16函数、实际双端对局/免伤/死亡/再战/重启/高清仍未验证，I13与两个函数父项保持未勾。

## 粒子炮弹与火箭炮弹

对应FUNC-22/FUNC-23。原`item.dat`的204行没有item2022/2023，ItemSkill1/2/3也不引用这两个技能；它们不是商品或真实弹药，当前不新建item、价格、库存、局内上限、商城入口或CPU配置。直接源事实与百分比采用政策分别见`special-ammo-2022-2023-business-design.md`，服务端接线见`special-shot-modifiers-runtime.md`。

当前有限执行器从认证角色的真实`RoleSkillSources`及`selectRoleSkills`结果重算，不读取全部目录技能或`currentAmmoTableId`猜技能。FuncType22在真实query边界忽略静态scene/crush遮挡，使用普通源XZ strip half-width25选择最近非自己存活角色，命中后沿既有damage/Critical/FF/immune/death/mode链；忽略只作用于本次射击查询，不改移动、碰撞或后续无遮挡弹丸。Func22 direct命中与连续弹丸命中共用同一普通ammo后效入口：命中真实2007/2008且造成有效伤害且仍存活时按原资格启动燃烧/减速，普通2001不新增后效。FuncType23原表X200按总范围百分比200%采用，普通1000对应2000，free/query与连续bullet可达距离同长度；增程bullet从中心总射程扣掉炮口前移，按剩余距离推进并在末步截到中心端点先sweep检测，未修饰弹种保持原2.2秒ttl。重复同技能不叠加，多项采用第一项X。未选时保持原query与1000默认。

修饰不改变确认后的真实弹药ID、消耗/装填时序或第二条400ms队列，不生成item2022/2023结果，也不新增效果、声音、资源或第二条400ms队列；战斗伤害数字继续使用既有原图片。每次权威重算先清除再由当前来源重建，离开已选来源后恢复普通行为。原server分派、原始X单位及完整玩家授予/取得链仍未恢复，保持FUNC-22/23未勾。

## 结算奖励与账户成长

对应M2-11、M6-02及UI-19/UI-20。原客户端结果接收回调按消息`+c0/+c4/+c8/+cc`读出金钱/星币/创意点/技能点signed整数，`+d4`在同控制器给出WIN/LOSE/DRAW；`439184`读结果对应DataScale率只决定该行显不显示，不对消息值再乘比例。原`datascale.dat`31–34胜利、35–38平局、39–42失败分别给出金钱/星币/技能点/创意点增加百分比+50/−20/−50。原`level.dat`1–20按累计积分阈值0/300/…/399000；21–27为排行榜百分比/名次、98/99为最高女性/男性，均依赖全服排名。

原服务端reward producer、资格、舍入与账户原写链未取得，当前按客户端接收、确认账户字段与原表参数采用：不把`combatScore`当原奖励显示，以每局非负四舍五入地图`combatScore`为重建基数base；各项读对应outcome的DataScale百分比，moneyBase=base、originalityBase=base/5、techBase=base/10、coinBase=0，分别按`round(base_i*(1+rate_i/100))`计算，只保留自然非负语义，不引入无来源的500/1000上限。coin保持0；money写入已有可花费确认余额profile`0x70`，不挪代币；累计积分/等级/创意点/技能点写入独立`account_growth`明确类型列，不覆写原`0x5c/0x9c/0xa0/0x80`，也不把结果技能点混作宠物学习`0x80`。积分累加冻结`totalScore`并以0为下界，等级取原1..20阈值中满足`>=`的最高档，21..27/98/99无排名来源不授。以上为采用规则实现。

首次`(account,matchId,round)`与既有`match_history`同SQLite事务写入receipt，重复返回同一receipt不重复加钱成长；账户缺失或写失败整场回滚，沿既有pending history队列重试，保存成功才在冻结结果上附`award`。重试成功后`flush`返回收据，`World.publishReceipts`只在房间仍存在、同roomId/round且`FINISHED`时补附，下个常规snapshot带late award；房间已释放只落库。CPU/旁观无account跳过，同一account多participants只结算一次；`forfeitOutcome`命中时离场人在delete前冻结真实身份并入FORFEIT结算，普通leave但留人继续时同样在delete与账号映射清理前冻结参赛者统计与真实accountId、不提前结算，终局与现`players`合并一次。共享合同`MsgRoomSnapshot.AccountGrowth`与`ResultAward`、`ResultPlayer.award?`、`ResRoleProfile.growth?`已提交beea00d；UI按4818b0c只渲染该receipt，不从local推算或重放授予。以上为采用规则，未在原Windows程序对照，实际对局/双网页/高清/持久重启未执行。

## 称号

对应M6-05。本批真实producer已把`settlement/title.ts`的selector 1–23全部接入，149–151按原说明拆为money、152–154拆为tokens，`FunctionType 2`沿现有domain的`a/b/c`单位，type 8/9只读真实九项完整计数，type 10与158号固定点按真实永久owned集合迭代；`RoleProfile`查询附`statistics/awards/titles/growth`，`selectTitleId`仍只做选择授权与badge刷新。原`title.dat`列`称号ID/称号名称/说明/FunctionType/FunctionX/FunctionY/FunctionZ/a/b/c`与统计选择器1–23已恢复；原客户端称号显示消费者为`game_main.xml`/`room_main.xml`的`txtPlayerTitle0..11`、`myhome_playerpage.xml:222`、`playerlist_playerinfo.xml:248`与`myhome_playerpage_titlesummary.xml`的`lstTitles`，当前佩戴原路径为角色属性`m_iNowTitle`（index2，record`+0x14`，type14）。原独立“选择/佩戴称号”请求opcode与成功回包、原服务端授予writer未取得，故不据此补造新请求。当前采用：授予在结算同一事务内按真实累计统计做exactly-once评估，持久化为typed`account_titles`/`account_title_selection`/`account_title_playtime`；默认无称号、首次授予无显式选择时按最大owned ID佩戴、`0`主动清空；累计wins/losses/draws/kills/deaths/最大连段从`match_history`全记录重算，`battleSeconds`只累加真实冻结时长；缺producer的hits/shots/damage/killCombo/九奖项/spend不授予。查询与选择走既有`RoleProfile`的`titles`/`selectTitleId`，选择只按认证账户授权并刷新该账户当前全部有效房间角色的typed badge（包括另一连接的角色）；请求连接PLAYING/LOADING拒绝，其它已授权连接的持久选择只改badge不改simulation，首次开局与再战新round从`currentTitle`重读。CPU/无账号不造默认称号，其它玩家资料为optional typed `title` badge，不暴露原私有资料/growth。原numeric链只作source fact，生产transport为typed badge；未在原Windows对照、实际网络/双网页/HD/持久重启未执行。

## 账户统计与九奖章

对应M6-05-A、M2-11、M5-06、M5-09及UI-19/UI-37/UI-38。battle producer 9f2293ae已接真实每局统计：shots为一次真实发射的普通当前ammo（CAS在`beforeFire`拒绝或`pendingShot`被取消/换局清空时不计，Func22/23只改修饰不产生第二发），hits按唯一shot identity（立即2001分支用shot id、飞行分支用`BulletState.id`）在真实敌对HP下降时至多一次，DOT/空袭/陷阱不带shot identity故计damage不计hits；damage/damageTaken取真实HP差clamp，友伤/治疗/背伤分列，治疗沿2009/4007真实恢复非自己友方并clamp到max，rearDamage复用现有背面分类，killCombo为真实无死亡最大连杀、真实death与新局归零。finishRound先冻结未加奖分结果再对全部真实active与中途离场者评九奖，每项award只加一次`combatScore`与`totalScore`、`outcomeBonus`不变、MVP在加奖前排名，全部awards保存；中途离场者深冻结`roundStats`与真实`playedSeconds`。account producer bdfbccf（main87966ac）已接`RoleProfile`统计/奖章/称号查询，基础wins/losses/draws/kills/deaths与最大连胜败取全部`match_history`，captured optional统计/奖章只汇总真实producer行，旧legacy缺项记unknown不补零。直接来源事实：原`m001..m005.dat`逐map的九组`Perfect/MVP/Savage/Console/Brave/Kind/Crafty/Shy/Greedy` enable/score列与四组Damage/DamagePlus字面值（含mode4的Kind/Crafty 50）；结果回调`+c0/+c4/+c8/+cc`四字段与`439184`显隐门禁、DataScale 31–42胜负/平局率；`myhome_playerpage_battlesummary.xml`十四个统计`StaticText`、`myhome_playerpage_awardsummary.xml`九个`txt*`计数、`game_summary.xml`每行`pic{Award}{i}_{0..4}`五个显示格。源每行只给五个图格，故UI按九奖章稳定顺序取前五项显示，其余权威awards仍写入结果与History，不被显示层删减，详`account-statistics-client-presentation.md`。

采用规则：参与者须本局`playedSeconds>0`；Perfect为deaths0且kills+objectivesDestroyed≥1；MVP按未加奖分的冻结`totalScore`最高（模式1–3每队1名、4/5全局1名，需kills/damage/objective至少一项真实正贡献，tie按kills/objectives/id）；Savage按敌方damage、Console按damageTaken且deaths≥1、Brave按deaths≥1且kills≥1、Kind按真实allyhealing、Crafty按rearDamage、Shy为shots0且damageTaken>0、Greedy为模式4/5最高正damage；enable非1不授，每type每玩家至多一次，score加一次入`combatScore`而outcomeBonus不变。Savage/Console/Kind/Crafty阈值采用`Damage + DamagePlus*max(0,敌对参赛者数-1)`，是按人数增加的采用单位政策而非原server证明，26map原列字面保留。判定、tie-break与该阈值见`account-statistics-and-awards-business-design.md`、`nine-awards-domain-runtime.md`。

统计契约见schema 101：`ResultPlayer.roundStats/awards`与`RoleProfile.statistics/awards`均为optional，真实producer只有真实ledger存在才附`shots/hits/damage/killCombo/spentMoney/spentTokens`，`battleSeconds`沿既有真实时长窗口，旧历史缺秒记unknown不套用timeLimit，缺字段保持空白不补0。`RoleProfile`查询与称号选择分离，`selectTitleId`只执行选择授权与跨连接badge刷新、不因查询追加授予；shots/hits比例条件只在全部history行都有`roundStats`时求值，任一旧行缺awards时“少于阈值”的奖项条件不授予，避免把未知旧次数当0。

## 账户支出统计

对应M6-05-A、M6-02及相关称号消费条件。直接来源事实：原`shop_purchases`/`tank_purchases`/`pet_purchases`/`part_maintenance`/`tank_maintenance`/`trade_receipts`收据表未冻结稳定原付款额。采用规则：新增`account_spending_ledger`在purchase/maintenance/trade各自的既有`BEGIN IMMEDIATE`事务内按实际提交金额记账，key为`(account_id,source,receipt_id)`，重放命中原receipt不重记、失败整体回滚；战车迷彩`configureTankTextures`在真实扣费时于同事务写新的`tank-texture` UUID收据，无变化或请求未发送不记。`readAccountSpending`仅在该账户至少有一条账本receipt时返回求和，否则`spentMoney`/`spentTokens`保持undefined表示unknown而非0。旧窗口不回填，也不按当前catalog价格反推历史成交额；Trade只记本账户outgoing money，收到金钱及originality/skillPoints不计。范围见`account-spending-runtime.md`。

Func19的12501/12502/12503 domain、history/account与真实World来源冻结已接（main 9f6620f/9d632fc），离场清技能前冻结；实际验收与P批次集中走查待做。Func6的domain 6b05507与P life 73ae1a2（source d14852e）已集成；统一shot/DOT/direct/trap/airstrike免伤predicate已接，死亡和respawn清旧保护，World apply/advance/Leave/finish/round桥及真实复活/lifecycle尚未接，FUNC-06保持未勾。Func21纯关系规则aeafb02及当前小地图消费已接，13111 jammer/13112 detector读取真实selected来源；本人/同队可见、敌对仅detector解radar jam且不破解optical invisibility，取得链与验收待做。Func17已有真实受害者被动一次复制与每生命清理，沿`pet-copy-skill-policy.md`保留范围，不假造完整原writer完成。Func20类别6数量事务domain与Account producer已写，实际bridge/consumer验收仍待做，30005未实现。地面掉落O的shared/schema106 83f138f与account事务be579f9保持已接，domain fda9ebb（source 49b9ce6）已集成，真实mode5 drop/接触40/普通action100 domain已写，World桥与UI尚未完成；当前桥接实现不宣称完成，OP整批一次集中走查尚未发生，掉落拾取合同见`ground-item-business-design.md`，不把30005治疗记为完成。

## 未完成范围

本批普通输入、消费、期限、目标、快照、Web表现和CPU接线已登记实现；本批一次集中gpt-5.6走查覆盖伪装、空袭与Func22/23，已修复发射边界恢复、普通输入快照先于事件发送，以及Func22/23的query options参数位、direct命中后效复用与Func23端点一致性三项真实问题。光学迷彩与建筑工具既有范围的集中走查与Castle重连稳态及修复事务共用损伤绘声清理保持原范围。确认已有库存的配置/自然施放、光学迷彩到期与死亡/结束/再战、建筑工具实际修复、双端绘声及库存重启恢复仍需实际验收；原未知字段、全部技能分派、五模式完整规则和M8-05不因这一合同关闭。FUNC-22/23只登记当前有限查询/射程执行器及采用的百分比政策，未执行实际玩家授予、取得或对局证据，不把source计算等同原server分派。

账户统计与九奖章本批已接battle/account/UI/支出producer与消费者：真实每局统计、终局评奖与奖分、账户累计奖章、RoleProfile查询、称号selector producer及迷彩/交易真实扣费收据均已实现，旧窗口缺值记unknown、不完整窗口不下比例或少于阈值结论。以上均为实现登记，未在原Windows对照，也未执行实际对局、双网页、高清、持久重启或真实交易验收；本批统计/九奖章/支出唯一集中gpt-5.6走查已完成，be4ffce修复真实fire计shots顺序、medical owner type、真参赛零奖awards[]旧记录unknown；静态走查不替代这些实测，M2-11/M5-06/M5-09/M6-05父项及UI-19/37/38保持未勾。
