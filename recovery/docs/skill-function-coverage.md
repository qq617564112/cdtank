# 原技能函数开发范围

来源：原skill.dat的342条技能、item.dat的204条道具。`recovery/.venv/bin/python recovery/export_skill_function_coverage.py`重建skill-function-coverage.json；`npm run assets:combat`发布供服务器/Web共同读取的combat-catalog.json。

源表共有1026个函数槽：684个type0槽、342个非零槽，非零类型1–23。下表的技能数量跨类型可能重叠；type6在两条技能中共三个槽。类型编号与描述只作为来源索引，尚不证明服务端函数语义。有限生产实现见本文末段与tasklist.md，全部原函数及实际验收仍未完成。

| FuncType | 函数槽数 | 技能数 | 源实例 | 首个实例参数T/X/Y/Z |
| --- | --- | --- | --- | --- |
| 0 | 684 | 342 | 1 宠物饲料 | 0/0/0/0 |
| 1 | 259 | 259 | 4 营养饮料打很猛 | 10/0/0/0 |
| 2 | 41 | 41 | 1 宠物饲料 | 0/0/0/0 |
| 3 | 3 | 3 | 4001 捕兽夹B | 5/0/0/0 |
| 4 | 3 | 3 | 4002 果酱B | 5/0/0/0 |
| 5 | 2 | 2 | 4003 软木塞B | 5/0/0/0 |
| 6 | 3 | 2 | 8 无敌软星 | 10/0/0/0 |
| 7 | 1 | 1 | 9 隐身装置 | 10/0/0/0 |
| 8 | 2 | 2 | 10 南瓜变变变 | 10/1/0/0 |
| 9 | 1 | 1 | 10221 大麦偷袭 | 0/0/30004/0 |
| 10 | 1 | 1 | 3 宠物注射剂 | 0/0/0/0 |
| 11 | 1 | 1 | 10441 最后一搏 | 3/0/0/0 |
| 12 | 4 | 4 | 3002 地雷 | 30/30/4023/3002 |
| 13 | 1 | 1 | 3001 古老炸弹 | 5/30/3009/3001 |
| 14 | 1 | 1 | 12 扫光光（扫把） | 0/0/0/0 |
| 15 | 6 | 6 | 3007 小型爆炸 | 0/0/3010/0 |
| 16 | 1 | 1 | 13 “救命啊”通讯器 | 0/20/3013/0 |
| 17 | 1 | 1 | 10711 你会我也会 | 0/0/0/0 |
| 18 | 2 | 2 | 501 1UP | 0/1/1/0 |
| 19 | 3 | 3 | 12501 金钱+100% | 0/100/0/0 |
| 20 | 2 | 2 | 20001 鱼骨 | 1/1/20001/0 |
| 21 | 2 | 2 | 13111 雷达干扰装置 | 0/0/1/0 |
| 22 | 1 | 1 | 2022 粒子炮弹 | 0/0/0/0 |
| 23 | 1 | 1 | 2023 火箭炮弹 | 0/200/0/0 |

生产目录现包含Range与原列19–46的28个数值属性，以原列名保留在attributes中，包括正/负HP、攻防、装填、弹量和精通。它们不自动赋予技能、不修改角色或消耗库存。技能1的HP=200、技能19的HP=-100及技能12的Range=400均来自原表；上限、目标、持续及服务器成功条件需分别恢复。

TriggerType现存0/1/2/3/4/5/6/7/8/9/11/12/13/14，Target现存1–6。coverage.json逐槽保留skillId、名称、原trigger/target/range、T/X/Y/Z和关联itemTableIds，runtimeStatus均为unimplemented。 该字段是导出时的来源阶段标记，不能作为当前生产实现状态；正式状态以tasklist.md逐条业务及专题文档为准。

原引用缺口：道具3006引用技能4027，当前skill.dat不存在该记录。缺口单独保留，不替换为4023等相近编号。

当前有限生产条目：物件3006按原description“全队队友生命回复400。”采用普通category4地面单次团队治疗，接入现有owned实例、账户CAS、数量扣减、00009地面对象、World生命写入与round统计；4027原writer、Func2、效果及声音仍未恢复，也不以3006业务冒充该技能已补齐。详[精品饲料罐头团队治疗](team-feed-client-business-design.md)及tasklist M4-10-I3006；FUNC-02、3006原取得链、真实页面/联机/HD/持久重启和M4-10父项均保持未勾。

每个FUNC子项按函数/目标/参数/持续的具体来源接入权威状态；原服务端入口缺失时按客户端请求、接收确认和表参数采用明确业务规则，详client-communication-business-rules.md。随后仍须用真人或CPU普通输入验收成功、失败、数量及真实事件。原432b29被动筛选和角色重算已有独立模块证据；不作为FuncType1主动施放完成证据。342技能及204道具的全量业务验收继续由M4-10追踪。

FuncType1的2010雷达干扰弹登记：`skill2010`为`Trigger0/Target1/Range0`Func1`T0`，`skill4008`为`Trigger8/Target1/Range1`Func1`T15`、RadarA/B/C均999、首槽Effect13/SE14。命中后的15秒雷达干扰是独立服务端期限与状态，不是FuncType1全量执行器完成；Radar列保持字面、不相加为被动属性，也不把4008的Func1映射为其它FuncType。取得、期限、marker与注射解除采用规则见client-communication-business-rules.md及ammo10-radar-*.md，FUNC-01保持未勾选。

FuncType2恢复前置已新增原生命赋值合同：433250 selector15先通过record通知12标记属性待同步，再按signed32限制0..record+58，最后按最终变化触发旧生命回调。共享role-health.ts与120次完整原setter/getter及Life调试格式执行一致（test:combat:health、role-health-native.json）。这不证明FuncType2会调用此setter，也不提供未恢复的目标、增量、授权或消耗条件；FUNC-02保持未勾选。详细字段及顺序见combat-field-inventory.md。

角色原属性注册另证明index12=m_iHP、index13=m_iMaxHP，数值type5绑定record+54/+58。原545d40属性写入直接复制signed32值、不经过433250的限制；applyRoleHealthProperty与20例原写读一致。完整34项注册与绑定均由原构造和元数据引擎执行（role-properties-native.json）；网络外层和函数分派仍未完成，不把属性更新等同于技能成功。

原记录通知521e8a→管理器529a10已恢复256位dirty位图，普通byte索引置对应位、fe置全部8个DWORD、ff不变；512组通知及120组完整生命setter/真实管理器链与共享role-property-dirty.ts一致（role-properties-native.json、role-property-dirty-suite.log）。这是属性待同步标记，不等于立即UI通知或FuncType2施放；FUNC-02继续保持未勾选。

原属性变化检测529a60已与630组真实34属性扫描对照一致；模式1/schemaMode2需要已有dirty位，进入扫描后重建位图，检测不刷新快照。HP/MaxHP的545f10原8字节数值段采用大端长度和signed32值，encodeRoleHealthProperty通过14组原字节对照；发送分支调用的545ee0刷新另已验证。证据role-properties-native.json、role-property-detection-suite.log、role-property-detection-types.log。另已执行原52a280管理器接收、53dbd0段解析、545ff0生命读取及52a8f0观察者转发，42组原链与receiveRoleHealthProperties逐值一致；重复值仍通知，按包中段顺序写入，失败保留已成功段，接收不限制生命或刷新快照。证据role-properties-native.json、role-property-receive-suite.log、role-property-receive-types.log。对象管理器52af80的键/命令分派已通过58组原执行，525630/525730/525830登记表查找及记录类型核对通过48组原执行，见role-property-route.ts和role-property-route-suite.log。命令5无论内部接收成功与否均返回“已处理”，不得以此认定FuncType2成功。真实登记表构造5275f0、模式1/2登记及526a70删除通过15组原操作；18组真实登记表到生命接收的组合与共享role-property-registry.ts一致，见role-property-registry-suite.log。网络事件536b70/536dc0的单个可选观察者转发另通过30项真实登记链原执行，与role-property-events.ts一致（role-property-events-suite.log）。观察者绑定/末端业务、模式1的原525030/529480属性清理另通过3组真实退役及102个实际字段析构，见role-property-cleanup.ts及role-property-cleanup-suite.log；保留角色值、owner、schemaMode与dirty位图。模式2类型工厂归还分派另通过模式0/缺失工厂/正常归还三组，原角色447e29及记录/管理器/34字段析构真实执行（role-property-factory-suite.log）。OdlPlayer真实工厂构造/注册及创建→登记→生命接收→移除归还链另已执行（role-factory-registration-suite.log），本测试单类型编号0不代表完整程序的固定编号。完整528170创建消息另通过6组真实schema/命令3初始生命读取/登记/移除归还执行，与createRolePropertyRecordFromMessage组合一致（role-creation-message-suite.log）。命令3内部属性失败时外层仍可登记，不把创建成功当作所有属性成功。上游5282e0/525520类别/收件人/命令分派另通过12组真实创建更新移除序列，与role-object-dispatch.ts组合一致（role-object-dispatch-suite.log）。原53d9c0完整字节包容器与53ee60网络接收入口另通过6组包拷贝/长度重写和84组类别/状态门禁对照，包含真实创建→阻止更新→生命更新→移除，与role-network-message.ts共享组合一致（role-network-inlet-suite.log）。数组544c70全量/增量编码与544950真实管理器接收另通过58/130组对照，全部342技能ID经当前16槽绑定进入生产状态/技能选择组合（role-array-property-suite.log）；接收不自动触发角色重算。全类型注册、完整服务初始化、TCP组帧/socket及FuncType2实际施放仍待恢复；共享网络模块尚未接入World，FUNC-02保持未勾选。

## 当前有限生产范围

物件9/skill9的Func7已接普通输入、CAS消费、权威10秒及生命周期、快照/Web敌对模型隐藏和CPU观察；物件10/11的Func8 X1/X2已接普通输入、CAS消费、临时技能与10秒状态、原4173/4174显示字段、快照/双方替身显示、合法开火恢复及CPU有限配置；物件502/skill502的Func18 X2/Y5000已接本队真实Castle恢复、普通消费、修复事件和CPU配置；物件13/skill13→3013→3012的Func16/15已接正式商城正价取得、槽5–8配置、普通输入CAS消费、权威XZ中心、20个实际configured tick、一次200×200范围选择、每目标direct HP-300、统一死亡/免伤链和有限CPU库存策略。skill2022/2023的Func22/23已从真实`RoleSkillSources`/`selectRoleSkills`重算射击修饰：Func22忽略静态scene/crush查询并按half-width25选择最近非自己alive单目标，且其direct命中与连续弹丸复用同一普通ammo后效入口启动真实2007/2008燃烧/减速；Func23 X200按总范围百分比200%将1000对应2000，增程bullet从中心射程扣炮口前移并按剩余距离截到同一端点；均不换真实弹药ID、不新建item2022/2023或第二条400ms队列。原零价/GGet0不开放免费购买，字段事实与采用的规则分列client-communication-business-rules.md；FUNC22/23 grant、取得链、原server分派及原始X单位保持未恢复。四项实际对局、绘声及持久验收仍待执行；FUNC-15共6技能不能因本次item13一件空袭关闭，Func2 directHP采用也不等同于原执行器恢复。

Func13的物件3001定时炸弹沿old-bomb-policy.md的既有有限普通购买/放置/直接伤害、双端原资源和同库重启证据；不以该子范围替代原执行器、未知X30或全部函数完成。342技能/204道具的完整状态继续按tasklist.md追踪。

物件3007/skill4024/4025/4026的Func3/4/5已接普通category4 placeTrap、CAS先成功后两数量单减、00009地面对象、Range80首敌接触后当前room全敌三lane、许可count/期限/生命周期和首槽通用通知；原flag observer与完整Func3/4/5父项保留，终态见[定时闹钟群体限制](alarm-clock-client-business-design.md)。

Func6的复活保护domain 6b05507/P life 73ae1a2与World桥88b726a已接：真实复活完成后授予5秒、首次spawn不授、真实时钟推进到期，死亡/Leave/finish/round/loading清理，统一shot/DOT/direct/trap/airstrike免伤predicate共用；实际验收待做，FUNC-06保持未勾。Func19的12501/12502/12503商城取得入口fea0765与商城UI d2c3a66已接，Home MARKER装配后profile0x13c三mark实例按owned实例解析ItemSkill1进入selectedSkills，snapshot与World冻结共同消费（a40e38d）；实际验收待做。Func20的20001/20002拾取数量入账随ground acquire账户事务与World桥真接；普通use不再加一，ItemSkill2=30005按普通request→既有CAS→治疗clamp→两量单减接入，失败不扣，成功itemUsed带definition.name沿现HUD。最后一份在同一AccountStore CAS事务删空实例与引用快捷槽并清当前角色零量记录/七槽/数组0；CPU真实CONFIGURE精确接受20001/20002到消耗槽5..8，正有限uint32是库存表示界而非每轮上限，无autoassign/gift；实际验收待做。Func21纯关系规则aeafb02及当前小地图消费已接，13111 jammer/13112 detector读取真实selected来源；本人/同队可见、敌对仅detector解radar jam且不破解optical invisibility；本批范围仅13111/13112关系读取、无新grant，合法取得链与验收待做。地面掉落shared/schema106 83f138f、account事务be579f9、domain fda9ebb（source 49b9ce6）、World桥88b726a与UI呈现fc83778均已集成，OP唯一集中静态走查四项finding均已交付（服务器O-S01/P-S01 a40e38d、UI main8b70bfe/source 8bdafe1d）；M2-10实际验收待做。

## 结算奖励与账户成长

对应M2-11/M6-02/UI-19/UI-20，与技能/道具目录的施放函数不同轴：它消费既有冻结`ResultPlayer`的战斗分与胜负，不改任何技能/道具执行。原reward producer、资格、舍入与账户原写链未取得，当前按客户端接收`+c0/+c4/+c8/+cc`、`+d4`、DataScale 31–42与level.dat 1..20阈值采用：以非负四舍五入`combatScore`为重建基数，moneyBase=base、originalityBase=base/5、techBase=base/10、coinBase=0，分别`round(base_i*(1+rate_i/100))`；money写profile 0x70，积分/等级/创意/技能写独立`account_growth`，不覆写raw 0x5c/0x9c/0xa0/0x80，结算技能点与`growth.tech`同源于`account_growth.skill_points`、并为宠物学习扣款的同一余额，原0x80字节保留；21..27/98/99无排名来源不授。首次`(account,matchId,round)`与历史同事务exactly-once，重复返回同receipt，失败整场回滚沿既有pending history重试，重试成功后`flush`返回收据并由`World.publishReceipts`对仍存在且同round的FINISHED房补附late award；CPU/旁观跳过，同account多participants一次receipt，`forfeitOutcome`命中时离场前冻结FORFEIT身份，普通中途离场在删除与账号映射清理前冻结统计与真实accountId、终局与现`players`合并一次。共享`AccountGrowth`/`ResultAward`/`ResultPlayer.award?`/`ResRoleProfile.growth?`已提交beea00d，UI呈现已提交4818b0c，server接线已提交59d8272并main5ae1561。原producer未取代、实际对局/双网页/高清/持久重启/grant未实测，M2-11/M6-02父项保持未勾。

## 称号与佩戴

对应M6-05，与技能/道具施放函数不同轴：`title.dat`158条完整目录经`settlement/title.ts`按`FunctionType`1/2/5/6/7/8/9/10解析并用固定点评估授予，缺producer的hits/shots/damage/killCombo/九奖项/spend保持unknown不授予。`accounts/title.ts`以typed`account_titles`/`account_title_selection`/`account_title_playtime`持久化永久拥有、显式佩戴和每局真实时长；授予挂在既有`AccountHistory.record`的`BEGIN IMMEDIATE`内、每条`match_history`之后，按`(account,matchId,round)`唯一门exactly-once，同account多连接合并取本round真实最长时长、CPU/无账号跳过。累计wins/losses/draws/kills/deaths与历史最大连段从`match_history`全记录重算，`battleSeconds`只累加真实的`startedAt→结束/离场`时长。`RoleProfile`回`titles {owned,selectedTitleId}`并处理`selectTitleId`0或真实owned；`PlayerState.title`/`PlayerSnapshot.title`及LobbyPlayers/Friends/Blacklist既有reply的optional title为权威badge，原numeric`m_iNowTitle`只作source fact不改写raw profile。原producer与真实网络/双网页/HD/持久重启未实测，M6-05父项保持未勾。
