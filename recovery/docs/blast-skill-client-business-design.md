# FuncType15 爆炸技能业务与实现合同

FUNC-15 共六条源技能：3007、3008、3009、3013、4004、13151。本文登记这六条的原表事实、当前正式 consumer/API、真实接线路径和限制。3009 与 3013 沿用既有正式实现；3007/3008 因没有真实 caller 保持 source-only；4004 与 13151 已接入当前正式 server/UI 普通全链。

## 原表事实

| Skill | Trigger/Target/Range | Func15 槽 | 首槽 Effect/Sound | 末端技能 | 真实来源 |
| --- | --- | --- | --- | --- | --- |
| 3007 小型爆炸 | 1/4/200 | T0/X0/Y3010/Z0 | 7/SE30/tag0/m1 | 3010 HP-100 | 无已确认 item/ammo/放置对象 caller。 |
| 3008 中型爆炸 | 1/4/200 | T0/X0/Y3011/Z0 | 8/SE31/tag0/m1 | 3011 HP-200 | 无已确认 item/ammo/放置对象 caller。 |
| 3009 大型爆炸 | 1/4/200 | T0/X0/Y3012/Z0 | 9/SE32/tag0/m1 | 3012 HP-300 | item3001，`3001 -> 3009 -> 3012`。 |
| 3013 呼叫器特效 | 1/4/200 | T0/X0/Y3012/Z0 | 60/SE32/tag0/m1 | 3012 HP-300 | item13，`13 -> 3013 -> 3012`。 |
| 4004 爆发弹B | 8/1/150 | T0/X0/Y19/Z0 | 9/SE32/tag0/m3 | 19 HP-100 | item2005，`ItemSkill1=2005`、`ItemSkill2=4004`。 |
| 13151 自爆炸弹 | 6/1/150 | T0/X0/Y19/Z0 | 9/sound0/tag0/m3 | 19 HP-100 | item17051，`ItemSkill1=13151`，ItemType12、部件分类12。 |

末端 19 为 `Trigger1/Target1/Range1`、`Func2 T0`、HP-100、Effect0/Sound0、首槽 method3；3010/3011/3012 为 `Trigger1/Target1/Range0`、`Func2 T0`，HP 分别为 -100/-200/-300，无 Effect/Sound 字段。19 是 4004 和 13151 的共同末端技能，但两条来源互不等价：4004 是普通 2005 的命中后爆风，13151 是被打死时由已装备 17051 产生的自身爆炸。

## 既有实现

3009 与 3013 已按原链落地，本批不重写：

- 3009：`readOldBombRule` 读取 `3001 -> 3009 -> 3012`；ground object 放置、到期、闭方形 200×200 和 direct HP-300 已接。
- 3013：`readAirstrikeRule` 读取 `13 -> 3013 -> 3012`；普通 item13 请求、CAS 消费、权威 XZ 中心、configured tick、闭方形 200×200 和 direct HP-300 已接。
- 两者末端都走 `damagePlayerDirectly`：同房、存活、`status2`、非本人、mode≤3 非同队，免伤不扣生命，统一死亡/mode 结算，不生成 `shotPlayerResult`。

3007/3008 保持 source-only。不得因为同名的 Effect7/8、同类 3010/3011 或 3009/4004 的既有链开放新购买、隐藏库存、免费取得、通用 trigger executor 或同名 ammo 映射。原 server writer 未知不阻塞 4004/13151 的真实既有来源推进。

## 4004 合同

### 来源与冻结点

4004 的真实取得来源是正式 item2005：普通商店已有 2005 正价 QUERY/BUY，普通 Home 武器槽选择，普通射击与有限 CAS 消费保持现有路径。4004 不是新 item，不新增 2022/2023 式假弹药，也不把 4004 单独放进快捷道具槽。

一次普通 2005 射击先走现有前段：确认 ammo2005、原始 direct 普通炮弹伤害、Critical/facet/免伤/抵消/死亡结算和既有 `shotPlayerResult.itemId=2005`。只有在前段真实命中交接点才记录爆发中心：

- 合法 player hit：在 `resolveShotPlayerHit` 收到真实目标后，以目标权威 XZ 为爆发点。不得用开火者炮口、look、客户端坐标或 `fire` 事件猜测落点。
- scene/objective hit：当前 2005 场景结果已存在，但“只有本批现真实确认来源允许 scenehit 时才接 scenehit”。本批采用 player hit 范围 policy，不新增 scenehit 范围触发；scene result 事件只是呈现 consumer，不是 4004 的权威伤害原因。
- terrain/free miss 不产生 4004 范围伤害，也不从呈现事件补造落点。

### 伤害与目标

爆发中心确认后执行一次 4004 结算：

1. 读取 skill4004 原字段：`Trigger8/Target1/Range150`、`FuncType15 Y19`、Effect9/SE32/tag0/method3。
2. `Range150` 固定解释为 XZ 轴对齐闭方形，完整宽度 150，即 `abs(dx) <= 75 && abs(dz) <= 75`，与现有 old-bomb/airstrike 的 `Range/2` 闭方形一致。
3. 合法目标采用现有 old-bomb/airstrike 敌对规则：当前同房、`alive`、`status2`、非施放者、mode≤3 时非同队，并通过闭方形。
4. 对每个合法目标调用一次 `damagePlayerDirectly(owner, target, 100, now, 19, events)` 或同形共享 consumer。skill19 是 direct HP-100，不走 ammo Critical、facet、饮料防御、抵消、吸收，不生成 `shotPlayerResult`。
5. 前段 base hit 可以把目标打死后，4004 仍以已冻结中心判定其它合法周围目标；已经死亡的目标 `alive/status2` 不再受伤，不重复 hit。4004 致死按现有统一 death/mode 结算，不在范围循环内重复 commit 同一目标。

### 事件与表现

4004 范围结算只复用现有 `MsgRoomEvent.type` 普通 string、`playSkillEffect` 和 `hit` 字段，不新增 schema/msg field，不运行 generator。每个目标命中沿 `damagePlayerDirectly` 产生既有 `hit(skillId=19, value=100)`；世界表现以 roleId0 `playSkillEffect={skillId:4004,effectIndex:0}` 消费原 Effect9。正式 `explosiveAmmoBlast` 事件在事件 XYZ 播放一次原 SE32 世界 WAV；2005 hit 呈现分支不再让旧附着 4004 图声重复消费。skill19 自身 Effect0/Sound0，保持 silent。原 Effect9/SE32 已发布时直接消费，缺失时只记录 source gap，不用同类资源替代。

### 时序与消费

4004 不再次消费库存。item2005 的普通射击、CAS 和弹药扣量仍由现有前段负责；4004 只在前段真实玩家命中确认后做一次范围结算。前段被拒绝、miss、terrain 或没有确认命中时不触发额外伤害。2005 sceneResult/其它 ammo/raw 通知不改变。基础命中先保留原 baseDamage、Critical、facet、hurt、伤害数字图和 `shotPlayerResult.itemId=2005`；随后从冻结的目标权威 XZ 执行一次爆风。前段致死已经可能结束 room；范围结算必须检查 phase，并按“死亡目标不复伤、周围合法目标仍按冻结中心一次判定”的顺序执行。

所有爆风命中和由其触发的连锁死亡完成后，终局只按最终 room 状态执行一次既有 mode 判胜与 settlement 冻结；不缓存或采用动作中途某次内部死亡算出的 `ModeOutcome` winner。mode1 最终双方生命相同时按既有 `teamLives` 比较规则平局，例如最终 `[0,0]` 为 draw。

### CPU

CPU 只在现有真实 2005 ammo/owned 来源允许时普通开火。4004 不新增 CPU 直接施放、虚拟库存、gift 或特殊输入。CPU 已通过现有 2005 射击命中后，沿用同一 4004 服务端结算。

## 13151 合同

### 来源与装备资格

item17051 是真实拥有部件：原表价格 1500 money/150 token，ItemType12。现 `classifyItemId` 的 `[10000, 8, 5]` 范围按 `first + floor((id - base - 1) / 1000)` 计算，17051 得到 `5 + floor(7050 / 1000) = 12`，即正常部件分类12。现 `partShopItems` 已包含分类8..12且 money/token 为正的普通部件，因此 17051 本来就在现普通部件 QUERY/BUY 资格内，不需要扩白名单、不改 ShopCatalog、不新增授予。

同一分类还适用现 `requestRoleEquipment` 与 unload 的 8..12 部件通路：正式 `Equip` RPC 在准备阶段校验 owned instance、分类8..12、槽数、冲突，再写入 profile 部件实例槽；`resolveBattlePartTableIds` 读取 owned instance、state2、ownedQuantity>0 和 tableId；`readRoleSkillSources` 把部件 table IDs 放入 `itemIds`；`selectRoleItemSkills` 展开 `ItemSkill1=13151`。17031 与该第 17xxx 类已有原正常部件通路证据，不重写装备规则。现有账户通过合法 Shop owned 来源拥有 17051 时，owned/Equipment/RoleSkillSources/selected source 即 qualified，直接复用同通路。

### 死亡触发

13151 的触发来源是 selected owned 17051，不凭私有字段、全局目录或角色名猜测：

1. 在 battle 的 selected source 上确认 `itemTableIds` 含精确 17051，且 owned instance 真实存在、state2、ownedQuantity>0、装备实例仍对应。
2. 只在真实 authoritative death commit 点触发，即 `commitPlayerDeath` 对每个真实死亡目标最多一次。死亡者位置在 commit 前冻结为 `{x,y,z}`。
3. 以冻结点为中心执行一次 150×150 闭方形范围：`abs(dx) <= 75 && abs(dz) <= 75`。合法目标采用与 4004 相同的同房、alive、status2、非本人、mode≤3 非同队和免伤规则。
4. 对每个合法目标调用一次 `damagePlayerDirectly(attacker=deadOwner, target, 100, now, 19, events)` 或同形共享 consumer。死亡者本身已经 dead，不在范围中重复受伤；周围合法目标各最多一次。
5. chain death：范围致死可依次进入真实 `commitPlayerDeath`。每个真实死亡 commit 最多消费自己的 13151 一次，不递归无限链。复活后再次死亡可再次触发一次；新 round 清空后重新按真实装备来源判定。
6. 未装备、没有 17051 实例、owned 为空、部件已被卸下或状态非2时不触发。17051 `BattleUseMax=0` 不自动改写为每局次数，也不在普通快捷槽产生使用动作。

### 事件、表现与来源记录

13151 不新增通用 trigger framework。死亡触发使用现有普通事件/伤害/死亡链；正式 `selfDestructBlast` 事件复用 roleId0 世界 Effect9，原 sound0 保持 silent，不接世界 WAV。skill19 的 `hit(skillId=19, value=100)` 已存在且 Effect0/Sound0，没有新 Effect/Sound。若原 Effect9 资源缺失，只记录真实 source gap；不造替代资源。死亡 credit 仍沿现有真实 kill/death credit policy，由范围命中的 `damagePlayerDirectly` 归属 dead owner，不新增伪字段或虚假 source。

### CPU

CPU 仅在现真实 owned/equipment source 已给出 17051 时获得该被动来源并沿真实死亡点触发；没有直接写库存、没有 gift、没有新主动输入、没有为 CPU 单独开放购买或装备策略。

## 当前 consumer 与实现边界

### Shared/server

| 文件 | 当前接线 |
| --- | --- |
| `apps/server/src/battle/items/explosive-ammo.ts`（new） | 读取 item2005 -> skill4004 -> skill19 的精确字段，导出 `readExplosiveAmmoRule()`、`resolveExplosiveAmmoBlast(room, owner, center, now, events, hit)` 和 roleId0 Effect9 helper；只处理 4004 一次范围/direct 100。 |
| `apps/server/src/battle/items/self-destruct.ts`（new） | 读取 item17051 -> skill13151、owned/equipment selected source 和 terminal19，导出 `hasSelectedSelfDestruct(player)`、`resolveSelfDestructDeath(room, deadOwner, now, events, hit)`；只处理死亡触发一次范围/direct 100。 |
| `apps/server/src/world.ts` | 在真实 2005 player hit 交接点冻结命中 XZ 并调用 4004 blast；在 `commitPlayerDeath` 真实死亡 commit 点调用 13151，每个死亡最多一次。复用 `damagePlayerDirectly`。当前动作内爆风与连锁死亡全部完成后按最终 room 状态执行一次既有 mode 终局判断，不缓存中途 winner。 |
| `apps/server/src/battle/projectiles.ts` | 现有连续弹丸玩家命中进入同一 `resolveShotPlayerHit` 边界；不改前段 ammo damage、scene result 或 miss。 |
| `apps/server/src/battle/catalog.ts` | 正式目录读取 exact item/skill 来源；不扩 Shop、不开放隐藏库存。 |
| `apps/server/src/accounts/equipment/request.ts`、`account-store.ts`、`battle-role-sources.ts`、`battle/projection.ts`、`battle/roles/skills.ts` | 复用现有 owned/Equipment/RoleSkillSources/selectRoleSkills 通路；17051 class12 已由现普通部件 Shop/Equip 源范围合格。 |

### Shared protocol

`apps/shared/protocols/MsgRoomEvent.ts` 不需要新 API/msgfield/schema。4004/13151 都复用现有 `type` string、`playSkillEffect`、`hit`、`destroy` 和 roleId0 world branch。不得运行 generator，不新增 executor abstraction。

### UI

| 文件 | 责任 |
| --- | --- |
| `apps/web/src/match/battle.ts` | 现有事件回调把正式 `MsgRoomEvent` 交给 `BattleSkillEffects.event`；2005 hit 呈现分支仅抑制旧 4004 附着 `showPlayerResult` 图声，保留 hurt/Critical/原伤害数字和 `shotPlayerResult.itemId=2005`，其它 ammo/scene result 不改。 |
| `apps/web/src/match/skills/battle-skill-effects.ts` | `explosiveAmmoBlast`/`selfDestructBlast` 的 roleId0 `playSkillEffect` 复用已有 world consumer；4004 在事件 XYZ 接一次原 SE32 世界 WAV，13151 sound0 静默，skill19/raw role0 静默。 |
| `apps/web/src/match/skills/skill-effect-notifications.ts` | skill19 silent 行为保持；不给 19 添加 Effect/Sound，不为 13151 造声音。 |
| UI resource | 原 Effect9 与 SE32 已发布时直接消费真实路径；缺失时才记录 source gap，不用同类资源替代。 |

## 顺序与边界

4004 顺序：真实 2005 ammo 前段 direct/普通 damage -> 判定原玩家目标是否命中 -> 冻结命中的目标权威 XZ -> 前段死亡可先 commit -> 4004 检查 phase -> 从冻结点一次 150 闭方形 -> 对每个仍合法目标一次 skill19 direct 100 -> 命中后沿统一死亡 -> 所有爆风与连锁结束后按最终 room 状态一次 mode 终局判断。

13151 顺序：真实 death commit -> 冻结死亡者 XZ -> 确认 selected owned 17051/13151 -> 一次 150 闭方形 -> 对每个仍合法目标一次 skill19 direct 100 -> 其死亡照常进入新的真实 commit，但每个 commit 最多触发自身 13151 一次。

共同规则：不重复消费、不对同一次来源重复范围结算、不因 scene 呈现事件补伤害、不因资源存在就赋予技能、不用同类资产替代缺 source。CPU 与网页只消费真实 owned/selected source；终局不采用动作中途 `ModeOutcome` winner。

## 限制

原 Func15 authoritative dispatcher、416f sender、X20/X30 单位与原 native 对照仍未恢复。3007/3008 的真实 item/ammo/caller 与末端 producer 仍缺，保持 source-only。4004 的原 server 成功 producer、scenehit 范围授权、非致死/terrain 规则及实际双端对局未确认；本批只接真实 player hit policy。13151 的原装备 producer、死亡触发 dispatcher、实际购买/装备/复活链与 HD 未确认；若没有真实 owned/equipment source 则不触发。原 dispatcher/HP writer、实际重启和全部父项保持未完成。
