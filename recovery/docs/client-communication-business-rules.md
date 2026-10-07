# 客户端通信规则与服务端业务

缺失原服务端程序时，服务端业务按客户端请求、接收回调、确认字段和原表参数还原。直接恢复的字段及消费者保留原来源；请求中没有目标或数值的业务由服务端从认证角色、拥有记录和原表计算。客户端未知包字段不赋予未经证实的含义。

普通使用43d4dc的存活status2、实例查找及本局数量门禁提供请求前置条件；3c9e只发请求，3c92独立确认扣量。当前服务端据此采用成功事务先保存、再改变本局数量与角色状态的顺序。重发普通输入由既有sequence门禁拒绝，失败保持库存与角色状态。是否成功由服务端完成作用及保存决定。

## 贵重品

对应M2-10、M4-02/FUNC-20、M4-10及treasure-item-client-configuration.md。原item表20001鱼骨/20002骨头为类别6、`ItemType=13`、`ItemMoney/ItemCoin/GGet/Durable=0`、`BattleUseMax=0`，`ItemSkill1`分别为20001/20002，`ItemSkill2=30005`；skill20001/20002为Trigger1/Target1/Func20，参数`T1/T2`、`X1`、`Y20001/20002`；skill30005为Trigger1/Target1/Func2、HP30、Effect11、GA15。物件说明写恢复15，与skill字段30冲突；当前采用规则使用skill字段30，文档保留15的源差异，不把说明文字当执行值。

Func20只负责地面拾取数量入账：服务端沿既有ground acquire账户事务把精确`itemTableId`的owned数量加一，不写HP，不增加tech points，也不在普通use再次加一。普通use由已配置快捷槽进入既有普通请求，仅精确20001/20002、存活status2、自用、真实skill定义、owned/本局量正数且存在生命缺口时执行；先经既有CAS消费一份，成功后再按HP30治疗并clamp到当前上限，owned与本局量各减一；满血、拒绝或保存失败不改HP、不扣量。成功itemUsed带definition.name沿现HUD。槽4..7对应Battle5..8；CPU真实CONFIGURE只接受精确20001/20002到消耗槽5..8，正有限uint32为库存表示界而非每轮上限，无autoassign/gift。

两件贵重品源的`BattleUseMax=0`保持原字段；采用规则按已配置实例的真实owned初始化可用量，不放宽到category6全类，不开放免费shop/gift，不做客户端预测。最后一份在同一AccountStore CAS事务删空实例与所有引用快捷槽，当前角色零量记录及七快捷槽/数组0清；其它物件保持原零量UPDATE。其它原物件仍按`min(owned, max(0, cap - roundUse))`。原服务端writer、真实双端、持久重启及高清验收仍未执行。

采用规则：原 kind5 sender/receiver 只保留上述来源事实；当前独立 `ValuableItemSale`
API58/共享 schema114，只接受 exact `20001/20002`。普通 Home 贵重页双击或 Enter 进入
数量弹窗，先 `QUERY` 只读 quote，再以同实例/数量 requestId `SELL`；成功只安装确认
inventory/money/profile。部分出售保留实例，完全出售清全部贵重品 hotkey 引用并移除
页面行；本机 cursor 按确认 inventory 重算。`SELL` 按该账户全部当前实际 room session
执行账户级门禁：无 room 或所有 `WAITING` 可出售，任一 `LOADING/PLAYING/FINISHED`
拒绝；`QUERY` 任意阶段纯读。首次成功把同一确认 inventory 安装到全部允许的当前 player，
全部取消 Ready，并按 `roomId` 去重各广播一次；历史 receipt replay 不重新取消 Ready，
无关账户不写。同 requestId/instance/quantity 重放沿用 receipts 与当前投影，不二次结算。

Web 请求 owner 取真实 `GameConnection` 认证结果和连接世代；显式登录和
`ensureConnected` 自动认证同源。发送 `ValuableItemSale` 前完成真实连接准备并核捕获身份，
跨页共享 token 由 A 变为 B 后不能把 A 的 pending 发到 B，旧查询和 confirmed projection
也不能装入新账户。已发送但结果不确定的 pending 用保存的 instance/quantity/requestId
独立确认，不因当前 quote、剩余数量或行已删除阻塞原 receipt；成功或明确未成交才释放。
room/round/stage 转换使旧显示世代失效并关闭数量弹窗，同 owner 未确定 pending 保留，
不允许阶段不发新 `SELL`，回可售阶段按原编号确认。普通 Inventory 刷新不得迟到覆盖
confirmed projection。

共享原 9 控件数量弹窗的根 CSS 同时覆盖 kind3/kind5，保持原零 padding、无浏览器默认
border/背景、原字体和 overflow；两个业务的独立 RPC 与 pending 不混用。API58/schema114
的两 ID 售价为 `0`，仍原子扣量并写 receipt；profile 的其它装备字段不清。

原 receiver 在类别 6 部分出售时只扣数量且不清资料引用，不能把当前服务端采用的
mutex、receipt 或完整 hotkey 清理宣称为原 Windows 等价行为。

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

## 爆发弹与自爆部件

对应FUNC-15、M4-10-I2005及M4-10-P17051。原`item2005`为普通弹药，`ItemSkill1=2005`、`ItemSkill2=4004`；`skill4004`为Trigger8/Target1/Range150、FuncType15 Y19、首槽Effect9/SE32/tag0/method3。原`item17051`为ItemType12部件、价格1500 money/150 token、`ItemSkill1=13151`、BattleUseMax0；`skill13151`为Trigger6/Target1/Range150、FuncType15 Y19、首槽Effect9/sound0/tag0/method3。两者共同末端`skill19`为Trigger1/Target1/Range1、Func2 HP-100、Effect0/Sound0、首槽method3；`3010/3011/3012`才为Range0。

普通2005射击沿现有确认ammo、CAS消费、炮弹飞行/即时命中、原始baseDamage、Critical、facet、hurt、伤害数字图和`shotPlayerResult.itemId=2005`。在真实玩家命中交接点，服务端冻结目标权威XZ；基础命中后执行一次4004爆风，以150全宽闭方形`abs(dx)<=75 && abs(dz)<=75`选择同房、alive、status2、非本人、mode<=3非同队目标，每个目标调用一次`damagePlayerDirectly(owner,target,100,now,19,events)`。爆风不再次消费库存、不加ammo armor/Critical、不生成`shotPlayerResult`，不因sceneResult、terrain、miss或raw通知补造中心。

13151只在真实最终死亡commit触发。服务端确认所选owned/equipped 17051实例、state2、ownedQuantity正数及部件数组2含17051后，冻结死亡XZ并执行一次同形150闭方形；每个合法周围目标一次skill19 direct HP-100。laststand仍alive0HP不触发，forfeit/leave不是战斗死；shot与direct death均沿现有真实死亡链。连锁死亡可依次进入真实commit，每名死亡最多触发自身13151一次；复活后可再次触发，新round按真实来源重建。

4004与13151复用现有`MsgRoomEvent.type`普通string、`hit`与`playSkillEffect`字段，无新API/schema/Msgfield或生成器。`explosiveAmmoBlast`携skillId4004、真实施放者id、空target、value0、冻结命中XYZ和roleId0 Effect9；`selfDestructBlast`携skillId13151、真实死亡owner、空target、value0、冻结死亡XYZ和roleId0 Effect9。原2005 player-hit呈现分支只抑制旧4004附着图声，保留hurt/Critical/伤害数字与来源字段；权威4004事件接一次原SE32世界WAV，13151 sound0、terminal19及raw role0静默。当前动作的base hit、爆风与连锁死亡全部完成后，终局按最终room状态执行既有mode/settlement比较冻结一次，不采用中途死亡结果；mode1最终同Lives为draw。

CPU仅从真实owned/equipped/selected 2005/17051来源消费同一普通链，不新增直接施放、gift、隐藏库存、同名映射或免费取得。17051已由现普通class12部件Shop/Equip/Unload范围合格，不扩Shop、不新库存。原server producer/dispatcher、精确source剩余项、真实对局、双端图声、持久、重启和HD仍未实测；I2005/P17051及完整FUNC-15/M4-10父项保持未勾。

## 粒子炮弹与火箭炮弹

对应FUNC-22/FUNC-23。原`item.dat`的204行没有item2022/2023，ItemSkill1/2/3也不引用这两个技能；它们不是商品或真实弹药，当前不新建item、价格、库存、局内上限、商城入口或CPU配置。直接源事实与百分比采用政策分别见`special-ammo-2022-2023-business-design.md`，服务端接线见`special-shot-modifiers-runtime.md`。

当前有限执行器从认证角色的真实`RoleSkillSources`及`selectRoleSkills`结果重算，不读取全部目录技能或`currentAmmoTableId`猜技能。FuncType22在真实query边界忽略静态scene/crush遮挡，使用普通源XZ strip half-width25选择最近非自己存活角色，命中后沿既有damage/Critical/FF/immune/death/mode链；忽略只作用于本次射击查询，不改移动、碰撞或后续无遮挡弹丸。Func22 direct命中与连续弹丸命中共用同一普通ammo后效入口：命中真实2007/2008且造成有效伤害且仍存活时按原资格启动燃烧/减速，普通2001不新增后效。FuncType23原表X200按总范围百分比200%采用，普通1000对应2000，free/query与连续bullet可达距离同长度；增程bullet从中心总射程扣掉炮口前移，按剩余距离推进并在末步截到中心端点先sweep检测，未修饰弹种保持原2.2秒ttl。重复同技能不叠加，多项采用第一项X。未选时保持原query与1000默认。

修饰不改变确认后的真实弹药ID、消耗/装填时序或第二条400ms队列，不生成item2022/2023结果，也不新增效果、声音、资源或第二条400ms队列；战斗伤害数字继续使用既有原图片。每次权威重算先清除再由当前来源重建，离开已选来源后恢复普通行为。原server分派、原始X单位及完整玩家授予/取得链仍未恢复，保持FUNC-22/23未勾。

## 红包拿来弹药

对应M4-10-I2016、M6-06及FUNC-02。完整普通链与源边界见[道具2016红包拿来普通弹药客户端业务设计与服务端实现合同](ammo2016-client-business-design.md)。原`item2016`为`ItemType=3`、`ItemMoney/ItemCoin=50/50`、`BattleUseMax=30`、`skillIds=[2016,4014,0]`，首槽`53/GA08/tag0/method3`；`skill2016`为`Trigger0/Target1/Range0`普通持有技能，`skill4014`为`Trigger8/Target1/Range1`、FuncType2、HP0，首槽`effectId=25/SE50/tag0/method3`。

取得与配置采用普通链：精确`2016`进入现`consumableShopItems`，沿现`Shop QUERY`/`Shop BUY`账户原子事务、`MONEY`或`TOKENS`正价`50`、`quantity`1..10、余额不足拒绝、同`requestId`重放返回既有receipt，成功才建owned；Home category2按现`ASSIGN`配置武器槽2..4，槽1保持默认`2001`，本局量按`min(owned,30)`初始化。不新增API、schema或免费grant。

普通`class3`选弹写`selectedAmmoSlot`/`currentAmmoTableId`并重算技能，失败恢复不消费；`beforeFire`的`consumeConfirmedAmmo`先持久CAS再扣本局量，成功后`fireProjectile`携`ammoItemId=2016`，权威命中写`shotPlayerResult.itemId=2016`。受害者端经4014首槽挂原025（retention0）一次并播SE50 selector1；remote scene endpoint与scene声音资格完整接入。原`4014`HP0不用于推导damage公式，普通现damage沿既有采用链。

原`025`树完整11节点、10个drawable，含`2807 type6 lifetime0`；controller0在`0..0.5s`以1000/s发射、capacity30、particlelife1，controller1从`0.5s`起emit0/end0，树无type4声音。现Web资源回收仅精确作用于`EffectRuntimeTree.quiescent`的`025/2807`：最后controller实际生效、当前与后续emitter不再发射、真实particle pool已drained且lifecycle不再产生未来emission时才回收，其余节点沿现finite结束；不改原phase/duration/controller/random/retained，不设任意expiry或新timer。该政策是Web资源回收，不声称原025 stop writer或SourceTree自然release恢复。普通双端实测、原stop caller与HD仍待完成，M4-10/FUNC-02及M6-06父项保持未勾。

## 雷达干扰弹

对应M2-02/M4-10及FUNC-01/FUNC-10/FUNC-21。原`item2010`为`ItemType`3、`ItemMoney/ItemCoin/GGet`均0、`BattleUseMax`15、`skillIds`2010/4008；`skill2010`为`Trigger0/Target1/Range0`Func1`T0`，`skill4008`为`Trigger8/Target1/Range1`Func1`T15`、RadarA/B/C均999、首槽Effect13/SE14。原完整432951既有合同不把RadarA/B/C相加为被动属性，原4008施加Radar字段的写地址与期限writer未取得；Radar列保持字面，不用它证明原列单位，也不把4008的Func1映射为Func21 grant。

取得与消费采用明确重建规则：mode5现权威BREACH链在`BREACH_POOL`精确加入`item2010`（`[1,2,2010,20001,20002]`），保持总体掉落概率0.5、池内uniform、每项无条件概率0.1；`dropitem`类别2数量1档为`021`/`obj05008`/`A`/`GA21`/`44`。不开放免费Shop或gift。普通pickup只入owned；初次未装槽`battleQuantity=0`，玩家正常退出/等待后经Home weapon槽1..3配置为Battle键2..4，15上限沿用原`BattleUseMax`，沿既有beforeFire/CAS单一路径消费，失败不改库存、不新增第二消费路径。

命中与期限：合法普通2010命中存活敌对目标且实际HP下降被接纳后，写入目标独立`{skillId:4008, expiresAt: now+15000}`；重复命中只刷新期限不叠倍，未命中、免伤、死亡、同队或非2010不作用。期限只影响战术小地图敌对player marker，不改世界/3D可见性、CPU观察、移动、瞄准或开火。快照以真实server clock投影可选Boolean`radarJammed`（schema107/id45，不新结束时间payload）；expiry/death/respawn/Leave/finish/round/loading清状态。普通`item3`在`acceptBattleInput`物品分派前以同一真实`now`推进雷达期限：到期对象先清除，仅剩到期异常时走无异常拒绝且不扣量；未到期状态保留到注射剂CAS成功后才解除，不改正面饮料或无敌。

观察关系：`canObserveRadarMarker`本人和mode1..3同队始终可见，mode4/5其余参与者按敌对；敌对marker在观察者本机`radarJammed`为真且无selected 13112 detector时隐藏，13112同时抵消2010与13111 jammer且不解除光学隐身。实际调用方`battle-minimap-renderer.ts`以三参数调用、默认读取本机布尔。合格2010命中携同受害者roleId的4008首槽`playSkillEffect`时只沿既`SkillNotifications`呈现一份Effect13/SE14，`radarJammed`状态事件只报告状态、不携效果；无该通知的普通2010命中仍走旧`showPlayerResult`。13111/13112合法取得仍无source。原Windows对照、真实双端对局、声画、高清与重启未实测，本批仅一次集中静态走查，M2-02/M4-10及FUNC-01/FUNC-10/FUNC-21父项保持未勾。

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

Func19的12501/12502/12503 domain、history/account与真实World来源冻结已接（main 9f6620f/9d632fc），离场清技能前冻结；商城取得入口fea0765与商城UI d2c3a66已接，Home MARKER装配后profile0x13c三mark实例按owned实例解析ItemSkill1进入selectedSkills，snapshot与World冻结共同消费（a40e38d）；OP唯一集中静态走查已完成，实际验收待做。Func6的domain 6b05507与P life 73ae1a2（source d14852e）已集成；统一shot/DOT/direct/trap/airstrike免伤predicate已接，死亡和respawn清旧保护，World桥88b726a已接真实复活完成后授予5秒、首次spawn不授、真实时钟推进到期及死亡/Leave/finish/round/loading清理；实际验收待做，FUNC-06保持未勾。Func21纯关系规则aeafb02及当前小地图消费已接，13111 jammer/13112 detector读取真实selected来源；本人/同队可见、敌对仅detector解radar jam且不破解optical invisibility；本批范围仅13111/13112关系读取、无新grant，合法取得链与验收待做。Func17已有真实受害者被动一次复制与每生命清理，沿`pet-copy-skill-policy.md`保留范围，不假造完整原writer完成。Func20的20001/20002拾取数量入账已随ground acquire账户事务与World桥真接；普通use不再加一，ItemSkill2=30005按普通request→既有CAS→治疗clamp→两量单减接入，失败不扣，实际验收待做。地面掉落O的shared/schema106 83f138f与account事务be579f9保持已接，domain fda9ebb（source 49b9ce6）已集成，World桥88b726a与UI呈现fc83778已集成；OP批次唯一集中静态走查已完成，四项finding均已交付集成：服务器O-S01/P-S01修复a40e38d、UI丢弃候选缓存刷新与FINISHED先到拾取声修复main8b70bfe（source 8bdafe1d），掉落拾取合同见`ground-item-business-design.md`。

## 快捷循环控制与服务端确认

对应M5-14/UI-50。来源事实：原`SystemSetting.ini`记录UseItem29、PrevBullet199、NextBullet207、PrevItem201、NextItem209，Attached字段均为0；原`settings.xml`对五动作各有主/备用键矩形。原战斗UI对五动作走UI按键事件链（回调`4ce6c4`），槽1直接选默认弹、槽2–4按类别分派到选弹或放陷阱、槽5–8走普通使用`43d4dc`；原索引不跨端点回绕。这些字段证明动作存在，但不含原Windows键位回调、扫描码映射与“当前选择”写入函数。详见 battle-cycle-controls-source.md。

采用政策：Web端在现普通`PlayerInput`链上实现五动作，不新增opcode、snapshot、schema或服务端消费规则，也不给普通message伪造业务回执。武器选择沿用普通`useItem(slot=1..4)`，服务端仍是`selectedAmmoSlot`与HUD权威，客户端只维护按输入次序的未决迭代意图：该玩家携带弹药`skillId`的普通`itemRejected`、`PlayerInput`发送promise的`isSucc:false`或reject、`local.ammoSlots`中未决请求槽消失/数量或`itemTableId`变化、直接数字/HUD选槽与生命周期重置都清意图回当前确认基线。道具侧只有`BattleItemInventorySnapshot.selectedItemSlot`这一本机cursor，写入仅限当前确认可用候选槽5–8，`useItem`读取时再按候选过滤；直接数字/HUD点空槽保留既有的一次普通请求但不写合法cursor；`prevItem`/`nextItem`只移动cursor，不请求、不扣量。原协议与server消费规则不新增。

未验收边界：原服务端键位回调与实际扣量/落点/技能成功结果仍未取得，不能声明为已恢复；上述为客户端采用规则，未做实际对局、双网页、高清或持久重启验收，也不把静态来源与client链等同原server分派。运行期接口见 battle-cycle-controls-runtime.md，设置与消费见 settings-cycle-controls-client.md。

## 战车改装

对应M6-03/UI-33/M6-06-TU。直接来源为原双 action 改装入口、TankUp 表费用/等级行、owned `+38/+48` 资格与 `+44/+54` 等级、`+3c/+40` 或 `+4c/+50` 攻防/加成字段，以及原3f94/3f95请求确认：请求只带 action 8位和 owned instance 32位，确认先替换完整 money/originality，再按 result 写等级和对应攻防/加成。原服务器结果抽样、返回 attribute/bonus 生成公式和 owned 资格位 producer 未取得。

当前 Web 采用规则登记为单一 `TankUpgrade` API：QUERY 只读返回当前 owned/profile 与 action1/action2 quote；UPGRADE 在账户 `BEGIN IMMEDIATE` 中校验 owned instance、action、资格位、目标 TankUp 行、费用和余额，扣 money/originality，更新 owned 等级和对应攻防/加成，并同事务写 `tank_upgrade_receipts` 与 `account_spending_ledger source='tank-upgrade'`。费用使用 owned `+24` Tank 表 TankMoney 与目标行 Money 的 uint32 低乘积再无符号整除 100，创意点读目标行；等级域 0..24、目标行 1..25，25 为终表哨兵，当前 24 及以上拒绝，最高可执行 23→24，失败下限 0。成功/失败/无效果按表字面值优先采样且不归一化；成功和失败以 Tank 表 Min/Max 无符号增减，属性/加成 clamp 0..0xffff，noEffect 保留当前值。新购 TankShop BUY 仅在新 owned equipment 写 `+38=1/+48=1`，旧/导入 `0` 不迁移，QUERY、SELECT、弹窗、重连、升级、交易、保养、迷彩和普通战斗不改资格位。

无房间与 WAITING 可提交；LOADING、PLAYING、FINISHED 在账户事务前拒绝。新提交在 WAITING 成功后重绑 inventory、角色来源和 equipment profile，取消 Ready 并广播；receipt replay 只返回历史 confirmation 并读取当前 owned/profile，不重扣、不重 roll、不回拨钱包/属性。当前 owned/quote 经 `roleRecords`、`selectedRoleSources`、`World.bindRoleSources` 与 profile 绑定进入现有战斗消费者。原 server 公式、普通自然伤害消费者、真实双端、持久重启、HD 与完整父项仍未实测或取得；M6-03/UI-33/M2-01/M6-06/M5-07 保持未勾。实现细节见 `tank-modification-client-business-design.md`、`tank-modification-runtime.md`、`tank-modification-client-presentation.md`、`tank-modification-implementation.md`。

## 维修期限

对应M6-03-CLOCK、M5-10与M7-07。原Tank owned `+34`与Part维修/耐久类ownedQuantity是分钟，原六按钮`1/7/30`天按`days×1440`增加，上限`367200`分钟（255天）；Tank/Part费用、余额、receipt与成功事务沿现维修模块。原server clock、provider与离线扣时writer未恢复，当前采用服务端持久绝对`expires_at_ms`墙钟，详见`maintenance-clock-client-business-design.md`。

有clock时当前分钟为`max(0,ceil((expires_at_ms-now_ms)/60000))`。只有正常成功维修在同Txn中先读取当前分钟、校验费用/余额/owned与255天上限，再写回原counter并建立或更新clock；拒绝、失败或回滚不改clock、counter、余额和receipt。无clock的legacy记录保持原raw分钟与原资格，`0`不推断过期、不赠时、不回填；maintained历史receipt保持完整immutable，当前列表、交易账户视图和重放读取live projection，不扣费、不重锚、不回拨。

过期保留owned/库存和装配关系，由现正量门禁按当前counter判断，不改变current battle frozen来源，不新增全局拒绝。初始化在既有inventory/role_records建表后一次执行；DELETE triggers统一清inventory删除的part clock与`role_records[kind=equipment]`删除的tank clock。显式导入替换沿用同一清理边界，普通profile、wallet、迷彩、改装和非owned/inventory删除不清clock。Shop/TankShop新BUY在创建真实新记录前清同空闲key陈旧clock，不创建clock、不改购入初值；Trade在物理删除前捕获原absolute expiry与当前projection，在recipient实际新id落盘后写原absolute expiry，与whole transfer同原Txn，普通stack不成为timed、不改merge。

## 大厅GM问题提交

对应M6-08-GM-LOBBY、M5-12与UI-03。原大厅菜单`rdoGM`、原`chat.xml`的`btnGMChannel`、原频道6`UMsgChatGM`与gamestring810自动回复为来源事实；原大厅GM单独处理程序、人工处理页、客服回复推送和原`rdoGM`回调未取得，详见`lobby-gm-question-client-business-design.md`。

当前Web采用：无room的普通已认证大厅账户可选原GM菜单，发送复用既有`RoomChat { text, channel: 6 }`。服务端`rooms/chat.ts`在无session拒绝前处理已认证channel6，有session仍校验当前玩家真实存在；大厅提交以空字符串`room_id/player_id`复用`AccountStore.submitGmQuestion`与`gm_requests`，不新增GM身份、人工客服、收费、Family、API或schema。text继续要求string、raw length `1..72`、trim非空且无控制码；插入失败不成功，不广播，房间GM原准入保持。UI保持原四菜单、原toggle与normal input，成功后仅本人session log追加`[GM]`和`[系统]`两条，pending防重复、失败保稿、稿有新修改保留，离房/断线/迟到generation丢弃，不自动重试，不进入公共/好友/密语路由。原大厅GM server等价、人工处理和完整`M6-08`父项仍保持未勾。

## 未完成范围

本批普通输入、消费、期限、目标、快照、Web表现和CPU接线已登记实现；本批一次集中gpt-5.6走查覆盖伪装、空袭与Func22/23，已修复发射边界恢复、普通输入快照先于事件发送，以及Func22/23的query options参数位、direct命中后效复用与Func23端点一致性三项真实问题。光学迷彩与建筑工具既有范围的集中走查与Castle重连稳态及修复事务共用损伤绘声清理保持原范围。确认已有库存的配置/自然施放、光学迷彩到期与死亡/结束/再战、建筑工具实际修复、双端绘声及库存重启恢复仍需实际验收；原未知字段、全部技能分派、五模式完整规则和M8-05不因这一合同关闭。FUNC-22/23只登记当前有限查询/射程执行器及采用的百分比政策，未执行实际玩家授予、取得或对局证据，不把source计算等同原server分派。

账户统计与九奖章本批已接battle/account/UI/支出producer与消费者：真实每局统计、终局评奖与奖分、账户累计奖章、RoleProfile查询、称号selector producer及迷彩/交易真实扣费收据均已实现，旧窗口缺值记unknown、不完整窗口不下比例或少于阈值结论。以上均为实现登记，未在原Windows对照，也未执行实际对局、双网页、高清、持久重启或真实交易验收；本批统计/九奖章/支出唯一集中gpt-5.6走查已完成，be4ffce修复真实fire计shots顺序、medical owner type、真参赛零奖awards[]旧记录unknown；静态走查不替代这些实测，M2-11/M5-06/M5-09/M6-05父项及UI-19/37/38保持未勾。

## 玩家公开资料

对应M5-13/M6-09/UI-41、UI-42、UI-43。原来源事实包括`playerlist.xml` 9控件、`playerlist_playerinfo.xml` 35控件和`playerlist_QQ_number.xml` 3控件，共47个源控件；原`playerlist_QQ_number.xml`只证明151×59小页、28,26..142,54九块框和36,32..135,48居中白字，原`btnQQ`、打开调用、外部URI/联系人动作和QQ号producer未取得。当前实现不展示QQ空小页，不把accountId/name/登录名/token当QQ，也不打开外链。

采用规则：新增`PlayerProfile` API57作为目标账户只读公开资料查询。请求只含`targetAccountId`；认证连接经`registerPlayerProfileApi`校验，目标不存在映射为`PLAYER_PROFILE_TARGET_NOT_FOUND`，未认证为`ACCOUNT_REQUIRED`。`AccountStore.playerProfile`只组合`displayName/currentTitle/statistics/awardCounts`、已持久`account_growth`，缺typed growth row时仅读已存原`role_profiles` summary的score/originality/tech；不使用`DEFAULT_GROWTH`补0，level未知保持空。统计与奖章沿既有history aggregate：真实aggregate 0可显示0，旧行缺可选`roundStats`时shots/hits/damage/killCombo保持空，缺awards时奖章保持unknown。该查询不授称号、不改钱包/库存/关系/房间，不返回raw bytes、strings、token、好友黑名单关系或聊天内容；共享schema当前为112。

Web消费为`AccountConnection.playerProfile→Battle.playerProfile`薄代理。`LobbySocialView`只传稳定查询函数，`PlayerInfoSession`按目标维护generation、pending和迟到响应清理；错误保当前目标和response并可局部重试，pending禁好友/黑名单/交易写，Close/原生Escape与原player row焦点恢复保持。35控件几何不改，family、个人介绍、level icon和原公开role icon继续明确未知。两统计radio读取所选目标response并挂接既有`myhome_playerpage_battlesummary.xml`/`myhome_playerpage_awardsummary.xml`原图片和文字控件；这是明确Web父容器附着，不复用owner history RPC fallback，也不声称原统计子页附着恢复。summary自身用`prepareSourceUi([suffix])`准备真实图片decode，失败保目标并局部retry，只重准备该页资源，不重发`PlayerProfile`。

本次未实测目标generation、error retry和resource处理；真实页面、真实联机、持久重启、高清和原QQ/原统计附着继续开放，M5-13/M6-09/UI-41/UI-42/UI-43完整父项不勾。

## 饰品购买

对应M6-06-HAT40。原来源范围只取category5精确`10001..10040`；`classifyItemId===5`当前采用范围为`10001..11000`，本批不把`11001..12000`纳入。原`item`表40行均为`ItemType=5`、`ItemMoney/ItemCoin`正、`Durable=3`，`GGet`为0或2；`ItemMoney`、`ItemCoin`、`GGet`与`Durable`均只作源literal登记，Web不把`GGet`解释为免费取得，也不据`Durable=3`实现期限、寿命初值或递减。

Web采用规则是在现`partShopItems`追加精确40个ID，并复用现`ShopItem`、`Shop QUERY`、`Shop BUY`、钱包检查、账户事务、receipt、inventory与owned实例；不新增API、schema、未知字段或客户端价格/余额权威。初始不预置库存，只有普通BUY成功后生成owned记录。UI只在确认`Shop QUERY`返回category5且命中精确40 gating时开放原`rdoShopHatPage`，Hat商品由现Part列表和现BUY消费，Common/Mark行为不变。成功拥有的category5实例沿原Home `DECORATION`装配路径和既有装备入口，owned Hat列表不新建第二套装备模型。

已售category8..12部件74件保持原资格，不重复追加。`2010`保持原`0/0`与mode5 breach掉落，不开放免费Shop。`2016`因原自然stop/release缺口未造。pet世界、原地图002、Seq及其它已关闭范围不改。原server出售授权、饰品世界渲染、逐币种支付、真实页面、持久重启与HD未实测；本批只登记已生产接线，M6-06父项保持未勾。

## 场景客户端资产

0008/0013的`obj05023` Sequence是客户端场景资产消费者，不新增客户端请求、服务端业务、RPC或授权规则。四条精确placement沿现有`ScenePreview` load/advance/clear边界消费已发布base、screen与`001–004`帧；screen实例克隆的既有原基色纹理在首次换帧前登记owner并在正常clear/失败清理释放。`scene-sequence05023.json` metadata尚未出版，实际页面资源加载、普通对局、像素、双端phase和高清未验；原Windows时钟provider不等同Web `performance.now()`采用。本批最终范围已完成一次集中静态走查，详`scene-sequence-runtime.md`。
