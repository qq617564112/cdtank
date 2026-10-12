# M2-01 独立攻防属性资格

`roles/recompute-armor.ts`发布`recomputeQualifiedRoleArmor`，输入明确ownedField34、ownedAtk(+3c)、ownedAtkBonus(+40)、ownedDef(+4c)、ownedDefBonus(+50)、实际tank/pet定义、实际tankType、RoleSkillSources、技能/物品/limits与getter9计数。缺任一owned字段、当前技能槽、datascale7～13或TankType不在1～4时拒绝；不默认0、宠物绑定或购入字段。

输出attackBase/attackBonus/attackPercent、defenseBonus/defensePercent/sideDefensePercent/backDefensePercent和selectedSkillIds，不写HP/生命资格/弹匣或角色dirty。HP、Critical、Lucky、VIP倍率及运动scales不属于这些七个攻防字段依赖；攻击属性和百分比不等于最终命中伤害，不提供伤害政策。

## 原直接来源与时序

| 地址/字段 | 已确认消费者 |
| --- | --- |
| 4334e8–4335b2 | role+70=0，+78=owned+40 signed32，+88=owned+50 signed32；role+74/+7c=0，+84=Tank.BackDef，+80=Tank.SideDef，存f32 |
| 432951 | Atk→+74及BackDef→+84用signed32源值乘倍率的宽乘法后加f32；Def→+7c与SideDef→+80先int32 imul再加f32；AtkBase/+70、AtkBonus/+78、DefBonus/+88 int32 imul/add回绕 |
| 4337d7–433ad6 | 原datascale7/8/9/10/11/13/12限幅对应上述字段，上界后下界，发生在装备精通加成之前 |
| 433ad6–433c55 | 四精通由实际pet+7c/+80/+84/+88与生效技能合成；owned+34明确0才减1最低1，实际TankType选择对应精通 |
| 421c4b/421c7a | signed32((mastery×5+10)×4)乘f32 .01，再乘owned+3c/+4c的uint32，分别加Atk/Def字段并存f32；不能把owned攻击/防御字段解释成signed32 |
| 433c55 | Atk/Def/BackDef/SideDef按原顺序乘f32 .01并存f32，其他int32字段不转换 |

原skill selector、baseId+rank−1、原被动筛选和getter9–FuncZ1倍率共用现有selectRoleSkills/roleSkillMultiplier。`recompute-effective-mastery.ts`把+34扣减/type选择作为唯一路径供movement/armor使用，原运动仿射及f32时序没有改变，不造scale0来计算攻防。

完整重算仅按批准hunks调用共用初始化/七字段累加/限幅/百分比/精通加成helpers，七字段累加仍位于原其他字段之间；原限幅顺序13后12、原通知/dirty不变。

## 局部规则证据

`tests/tank-armor-qualification.cts`用原owned equipment和paired拥有记录解析、真实skill source及role-recompute-native.json逐值对照七个输出和selectedSkillIds，563完成向量与1缺槽拒绝PASS。缺五个独立owned字段分别拒绝，缺currentSkillIds/每个id7～13及无效TankType拒绝。类型契约要求TankType单独传入，与现有movement一致，不修改shared坦克结构。

共用抽取影响完整重算与精通，必要回归564完整/通知/dirty、254缺源保留、16paired→Account→getter及758原精通/type/uint32装备加成向量全部通过，未重执行原native/倍率/a0。最终focused strict Bundler类型通过；首次tank-armor-qualification-types.log保留，最终-types-final.log为当前接口结果。证据tank-armor-qualification.json/.log、-full.log、-mastery.log。

## 正式应用与未恢复范围

主线owns attributes、伤害consumer与World，独立armorReady/recoveredArmor已正式接入，defense-drink按独立来源消费；数值线只修改已协调的规则模块和专属证据。模块PASS不等于正式伤害恢复或玩家命中验收。正式投射物伤害、侧背命中消费者、原server授权/随机项需另注册源充分政策和实际对局，不以显示Attack或attackBase直接替代完整公式。

原owned+34语义/购入初值仍未知，真实购入写0已明确为重建；role+a0独立宠物技能绑定缺caller，按两次停止条件保留，不第三扫描、不推selected pet拥有为boundGear。原客户端正常行为测量未取得；本片原x86向量不当客户端实测。原11车正式取得、完整宠物装备技能组合及M2-01完整原生命/攻防/伤害父条件均未完成，不勾父项。

## 正式资格稀疏来源首断言

`tests/tank-armor-sparse-qualification.cts`用已有真实tank3/pet2购买raw的本地复制，normal/VIP×14条件共28项PASS，focused strict NodeNext类型PASS。缺owned HP/Critical/Lucky或三者均缺仍独立armorReady并保持七字段；缺+34/+3c/+40/+4c/+50、pet定义、实际坦克不一致或equipment技能来源字段拒绝。已计算后撤回equipment立即清armorReady/recoveredArmor，当前HP不改。VIP未知生命倍率不阻这些已确认攻防属性；完整属性ready与独立armorReady分开。

该测试没有把稀疏记录写进Account或活跃room，不代表普通取得/实际命中伤害。World.roleAttributes/projection发布独立属性，RoomSnapshot未扩七字段协议；下述正式网络验收通过公开defenseBoost消费者输出核对属性，不使用服务器观察器。

## VIP正式购买防御消费者首验

`tank-armor-defense-purchased-network-2026-10-04T17-04-54-772Z.json`PASS与专属focused类型PASS。四真实Account初始零拥有，第二玩家资金profile明确100000测试夹具→TankShop tank3/PetShop pet2真实BUY→SelectRole→Shop drink5 BUY1→Kitbag4；mode3/map7实际VIP使用普通useItem5。未导入拥有/库存或注入HP/位置/伤害，独立armor资格不受未知VIP生命倍率影响。VIP生命仍200重建房间政策，不称原VIP700倍率恢复。

实际统一原属性：DefPercent0.10199999809265137、DefBonus44；drink5实际技能入槽后DefPercent0.4020000100135803、DefBonus64。正式defenseBoost来源original-attributes，baseDefense44.10199999809265、boostedDefense64.40200001001358，与独立公式一致；施放后当前生命200不改变，库存真实1→0。自然CPU154 hit43.300195858153714，双端45共同tick全players一致，四正常Leave及server/tmp清理。该命中为自然业务证据，不能直接推定原伤害规则。

原属性percent+bonus合成防御值及`(100+base)/(100+boosted)`缓伤比例均为既有重建政策，projectile attack规则未改；不将AtkBase或显示攻击值当完整damage。本片未新增观察器/RoomSnapshot字段，公开defenseBoost就是实际消费者输出。active tick2固定模拟0.1秒，serverTime1791133496602、接收wall1791133496605，全部时基原采样在raw，未宣精确墙钟装填或生命performance。

索引tank-armor-player-accepted.json限定这一VIP组合；normal/VIP28稀疏断言仍是局部规则而非稀疏账户network。主线owns正式接线/消费者，本线专属runner和证据；未重原native、运动/生命/旧normal饮料全链。M2原生命/攻防/伤害父条件继续未勾。

## 拥有期限字段来源补充

`owned-tank-duration-mastery-source.json` 通过原MyTank getter4d88f1与3aab handler428ec5/gamestring875，确认owned+34为剩余分钟；0条件的四类精通减1下限1仍复用原数值消费者。原购入初值、期限扣减和维修恢复producer未确认，现BUY写0仍明确重建。字段含义不再列为未知；不扩大已验角色组合或改变正式数值行为。
