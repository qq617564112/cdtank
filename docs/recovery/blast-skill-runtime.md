# 爆发弹与自爆部件运行接线

本文登记FUNC-15中4004与13151的当前正式server路径。来源事实、业务采用规则、客户端消费者及限制分列`blast-skill-client-business-design.md`、`client-communication-business-rules.md`与`blast-skill-client-presentation.md`。

## 来源与规则

| 节点 | 当前读取 |
| --- | --- |
| `item2005` | `ItemType=3`、`ItemSkill1=2005`、`ItemSkill2=4004`。 |
| `skill4004` | Trigger8/Target1/Range150、FuncType15 Y19、首槽Effect9/SE32/tag0/method3。 |
| `item17051` | ItemType12、价格1500/150、`ItemSkill1=13151`、BattleUseMax0。 |
| `skill13151` | Trigger6/Target1/Range150、FuncType15 Y19、首槽Effect9/sound0/tag0/method3。 |
| `skill19` | Trigger1/Target1/Range1、Func2 HP-100、Effect0/Sound0、首槽method3。 |
| `skill3010/3011/3012` | Trigger1/Target1/Range0，HP-100/-200/-300。 |

4004与13151的Range150按XZ轴对齐闭方形解释：`abs(dx) <= 75 && abs(dz) <= 75`。外层技能一次选择目标，terminal19的Range1不重新扩选。合法目标沿现有old-bomb/airstrike规则：同房、`alive`、`status2`、非本人、mode<=3时非同队，并经过统一免伤链。

## Server

`apps/server/src/battle/items/explosive-ammo.ts`读取`item2005 -> skill4004 -> skill19`，导出`readExplosiveAmmoRule()`、`resolveExplosiveAmmoBlast(...)`和roleId0 Effect9消息构造。4004每次业务只做一个事件与一轮范围/direct100，不再次消费弹药，不生成`shotPlayerResult`。

`apps/server/src/world.ts`的真实玩家命中交接点先保留原有baseDamage、Critical、facet、hurt、伤害数字来源及`shotPlayerResult.itemId=2005`。若ammo为2005，在调用基础`applyPlayerDamage`前冻结目标权威XZ。基础命中完成后，同一`runCombatResolution`边界调用`resolveExplosiveAmmoBlast`；前段已死亡目标跳过，其它仍在闭方形内的合法目标继续从冻结中心结算。

`apps/server/src/battle/items/self-destruct.ts`读取`item17051 -> skill13151 -> skill19`。`hasSelectedSelfDestruct`同时检查equipment parts中的owned实例、inventory记录的精确itemTableId/state2/ownedQuantity正数、ItemSkill展开含13151，以及战斗record数组2实际含17051。`resolveSelfDestructDeath`在真实死亡commit后冻结死亡XZ，发一次`selfDestructBlast`并执行同形150闭方形。

`commitPlayerDeath`仅在真实alive到dead转换后调用13151；范围命中通过`applyDirectSkillDamage -> damagePlayerDirectly`进入既有skill19 direct HP-100、死亡、kill/score、队伍生命与mode链。连锁死亡进入各自真实commit，每名死亡最多触发一次；laststand仍alive0HP、leave或forfeit不触发。

## 终局与顺序

基础命中、4004爆风、13151自爆和由它们触发的连锁死亡全部完成后，`world.ts`在combat-resolution最外层按当前room状态重新执行一次既有mode判胜，再进入现有settlement冻结。实现不缓存或采用动作中途某次内部死亡产生的`ModeOutcome` winner；mode1最终以当前`teamLives`进入既有比较，最终为`[0,0]`时按既有规则为draw。该边界只作用于本动作，不改变不相关射击、普通时间终局或模式表。

4004顺序：确认ammo2005与基础命中 -> 冻结命中XZ -> 基础伤害与死亡处理 -> phase检查 -> 一次150范围 -> 每目标一次skill19 direct100 -> 连锁死亡 -> 最终状态判胜。

13151顺序：真实死亡commit -> 冻结死亡XZ -> selected owned17051/13151资格 -> 一次150范围 -> 每目标一次skill19 direct100 -> 连锁死亡 -> 最终状态判胜。

## 事件与协议

两个domain事件复用现有`MsgRoomEvent.type`普通string字段，不新增union、API、schema或生成器步骤。

- `explosiveAmmoBlast`：`skillId=4004`、`playerId=owner.id`、`targetId=''`、`value=0`、冻结命中XYZ、`playSkillEffect={skillId:4004,effectIndex:0,duration:0,roleId:0,xBits,zBits}`。
- `selfDestructBlast`：`skillId=13151`、`playerId=deadOwner.id`、`targetId=''`、`value=0`、冻结死亡XYZ、同形roleId0`playSkillEffect={skillId:13151,effectIndex:0,duration:0,roleId:0,...}`。

terminal19命中仍经既有`hit(skillId=19,value=100)`，本身Effect0/Sound0。4004世界表现唯一负责原Effect9/SE32图声；13151原sound0静默。事件使用真实施放者/死亡owner、权威room坐标和现有float32位payload，没有新库存、持久字段或跨round次数记录。

## CPU与取得

CPU不新增主动技能或直接库存写入。只有现有真实2005 ammo/owned射击或17051 owned/equipment selected来源已给出时才沿普通链消费。17051通过现class12部件Shop/Equip/Unload路径取得和装备，不扩Shop、不gift、不预置库存。

## 限制

原server 2005成功producer、4004 scenehit范围授权、13151原装备producer/死亡dispatcher、416f/Func15精确source剩余项、HP writer与native对照仍未恢复。3007/3008仍source-only。真实双端对局、图声实载、复活/再战、账户重启持久及HD尚未实测；本文件只登记当前正式静态实现路径。
