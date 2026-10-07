# 技能函数1/2（FuncType1/FuncType2）生产来源与消费合同

来源：`recovery/output/verified/tables/skill.csv`、`skill.json`（原 `CDTank/Data/table/skill.dat`）、
`recovery/output/web-assets/combat-catalog.json`、`recovery/output/skill-function-coverage.json`，
`apps/shared/content/definitions/*` 与 `apps/server/src/content.ts` 内容加载链，
配合 `apps/server/src/battle/roles/*` 属性重算链与 `apps/server/src/battle/*`、`apps/server/src/battle/items/*`
实际消费者。原表事实与 Web 采用规则分列；单位、目标、授权未由原服务端证明的边界留在本文末 Known Issues。

## 0 结论

FuncType1/FuncType2 不是“没有生产消费者的通用执行器”。当前树内它们已有三条真实消费路径：

1. 角色属性重算：`RoleSkillSources` → `selectRoleSkills` → `recompute-*`。FuncType1 的 `T=65535`（0xffff）
   是原 `0x432b29` 的被动判定标记；被选中技能的 28 个数值属性列按原偏移累加，再受 DataScale 限制并做百分比转换。
2. 专用消费者：各道具/宠物/特殊弹药模块直接读 `functions[].type` 与 `T/X/Y/Z` 以及 `attributes.*`，
   分别实现定时增益、生命增减、周期治疗、伤害终端等。
3. 宠物规则路由：`content.ts` 加载 `definitions/index.json` → `pets/*.json` 的
   `{event, handler, target, condition}` 规则 → `readPetSkills` 选择技能 → `PetBattleSkills` 的
   `event/handler` 分派与宠物流专用消费者（击杀回血/受击移动/团队复仇）。10211/10231/10241 均在此覆盖。

`skill-function-coverage.json` 的 `runtimeStatus=unimplemented` 是导出阶段标记，不代表当前生产状态。
除下文第 3 节列出的具体项外，本树未显示新的、正常可达的 FuncType1/2 生产缺口；不新增通用执行器、
不新增 enum/迁移/wrapper/feature flag，也不因原表有记录而自动授予技能或开放免费取得。

## 1 原表字段与实际语义

### 1.1 槽与列

- 原 `skill.dat` 共 342 行技能；每行含 3 个函数槽，各 `FuncTypeN/FuncTN/FuncXN/FuncYN/FuncZN`。
  coverage 口径为 1026 槽 = 684 个 type0 槽 + 342 个非零槽（类型 1–23）。
- 28 个数值/机制列（列 20–47）：`MaxHP, HP, HPRegainRate, HPDrain, Critical, Lucky, AtkBase, Atk,
  AtkBonus, Def, DefBonus, SideDef, BackDef, ItemMove, ItemTurn, Delay, MaxBullet, LoadTime,
  MaxCounter, StunRate, PartSlot, RadarA, RadarB, RadarC, STankMastery, MTankMastery, LTankMastery,
  StugMastery`。
- 3 个绘声槽：`EffectN/SoundN/EffectTagN/EffectMethodN`。

### 1.2 TriggerType / Target / Range / FuncT / FuncX / FuncY / FuncZ

| 字段 | 直接来源事实 | 当前生产采用规则 |
| --- | --- | --- |
| TriggerType | 原整数选择子；`0` 进入被动分支，`14` 参与 `0x432951` 倍率 | 被动只在 `TriggerType===0` 且首三槽出现 `Func1/T=65535` 时采用（`roles/skills.ts:isPassiveRoleSkill`）；`14` 时倍率 `= getter9 − FuncZ1`（>0 才生效，否则 1），见 `roles/reload.ts:roleSkillMultiplier`。其它值仅供各专用模块按 `triggerType` 精确门禁（如 1/4/5/6）。 |
| Target（TargetType） | 原整数列，实例见 1–6 | 不把 Target 当通用引擎值。各消费者按需精确匹配：`1`=自用（饲料/饮料/注射/建筑工具/雷达等）；`3`=触发瞬间全体敌对（闹钟采用）；`4`=范围（爆炸采用）。未证明的目标分支保持开放。 |
| Range | 原整数列 | 不做通用距离计算。个别业务采用为触发半径/范围（如闹钟采用 `80` 为首个接触半径），见各专题合同。 |
| FuncT | 原 int32 参数 | 多数 Func1 定时态采用为秒数（`t*1000`：饮料、受击移动、减速）；Func2 周期态 `999` 表示重复、`0` 表示瞬时；`65535` 为被动哨兵。单位原义未证明。 |
| FuncX | 原 int32 参数 | 按 funcType 采用为周期/计数/宽度/百分比等（宠物周期回血用 `x` 秒；地面爆炸用 `x` 半径、`z` 模型；Func23 用 `x` 为百分比）。 |
| FuncY | 原 int32 参数 | 常被采用为被引用技能 ID（放置技能 `create.y` → 爆炸技能；动作技能 `action.y` → 被调用技能）。 |
| FuncZ | 原 int32 参数 | `FuncZ1` 作 Trigger14 倍率基数；宠物低血量条件采用为百分比阈值。 |

### 1.3 28 数值属性 → 运行时字段（直接映射）

偏移与倍率来自 `roles/recompute-{skill,life,ammo,armor,movement,limits}.ts`；`x0.01` 表示最终转百分比。

| 原列 | 重算入口 | 运行时字段 | 备注 |
| --- | --- | --- | --- |
| MaxHP | `accumulateRoleLifeSkill` | `recordFields+0x58`（MaxHP） | int32 累加；DataScale1 限制；VIP 字节非零时再乘倍率（倍率未恢复） |
| HP | 无 | 无 | 不进 recompute；由 Func2 专用消费者读作治疗/伤害量 |
| HPRegainRate | `recompute-skill` floatAdd | `roleFloats+0x8c` | DataScale3；`x0.01`；饲料恢复按它放大（采用公式） |
| HPDrain | `recompute-skill` floatAdd | `roleFloats+0x94` | DataScale4；`x0.01`；供弹丸吸血 |
| Critical | `recompute-skill` floatAdd | `roleFloats+0x68` | DataScale5；`x0.01` |
| Lucky | `recompute-skill` floatAdd | `roleFloats+0x6c` | DataScale6；`x0.01` |
| AtkBase | `accumulateRoleArmorAttribute` | `roleIntegers+0x70` | DataScale7 |
| Atk | `accumulateRoleArmorAttribute` | `roleFloats+0x74` | DataScale8；`x0.01` |
| AtkBonus | `accumulateRoleArmorAttribute` | `roleIntegers+0x78` | DataScale9 |
| Def | `accumulateRoleArmorAttribute` | `roleFloats+0x7c` | DataScale10；`x0.01` |
| DefBonus | `accumulateRoleArmorAttribute` | `roleIntegers+0x88` | DataScale11 |
| SideDef | `accumulateRoleArmorAttribute` | `roleFloats+0x80` | DataScale12；`x0.01` |
| BackDef | `accumulateRoleArmorAttribute` | `roleFloats+0x84` | DataScale13；`x0.01` |
| ItemMove | `accumulateRoleMovementSkill` | `accumulators[0]` | DataScale14；供运动/精通 |
| ItemTurn | `accumulateRoleMovementSkill` | `accumulators[1]` | DataScale15 |
| Delay | `accumulateRoleAmmoSkill` | `roleFloats+0x50` | DataScale16；最终 `x0.1` |
| MaxBullet | `accumulateRoleAmmoSkill` | `recordFields+0x38` | DataScale17；弹匣容量 |
| LoadTime | `accumulateRoleAmmoSkill` | `roleFloats+0x54` | 最终 `= 0x50 * 0x54 * 0.03`；无独立 limit |
| MaxCounter | `recompute-skill` integerAdd | `roleIntegers+0x58` | DataScale20 |
| StunRate | `recompute-skill` floatAdd | `roleFloats+0x90` | DataScale22；`x0.01` |
| PartSlot | `account-store` 装备容量 | `partSlots` | 经 `roleEquipmentSlotCount` 决定装备槽数 |
| RadarA/B/C | 无 recompute 消费 | 无 | 保持字面；雷达干扰期限采用 item 规则量，不相加为被动属性 |
| STank/MTank/LTank/StugMastery | `accumulateRoleMovementSkill` | `accumulators[2..5]` | 由 TankType 选有效精通分量 |

倍率：`roleSkillMultiplier(skill.triggerType, roleValue9, skill.functions[0].z)` 对上述所有属性一致；
`TriggerType14` 且 `getter9 − FuncZ1 > 0` 时倍率取差值，否则 1。

## 2 已接 source → consumer 路径

### 2.1 来源选择（共用）

- `roles/skill-sources.ts:readRoleSkillSources`：由 `currentSkillIds`（记录数组槽4）、`runtimeSkillIds`、
  绑定拥有战车六槽（`boundGear` +0x44../+0x5c..）、角色额外技能（`roleFields+0x88/+0x8c`）与
  十个物品槽（equipment +0x58/0x5c/0x60 + roleFields +0xbc..+0xcc/+0x70/+0x6c）构建 `RoleSkillSources`。
- `roles/skills.ts:selectRoleSkills`：顺序为 current 16 槽 → runtime 去重 → 拥有战车槽被动 →
  额外技能 → 物品槽被动（`selectRoleItemSkills`）→ Home MARKER 技能。仅 equipment/extra/item 来源需过
  `isPassiveRoleSkill`；current 槽内技能无条件入选。
- `roles/skills.ts:isPassiveRoleSkill`（原 `0x432b29`）：`triggerType===0` 且首三槽内出现
  `type===1 && t===0xffff` 即被动；另保留雷达 `Func21` 特例 13111/13112。

### 2.1a 内容加载与宠物规则选择（content loader → defs → rule）

- `apps/server/src/content.ts` 是内容 loader：读 `apps/shared/content/definitions/index.json`，按其中
  `pets/tanks/items/skills` 各文件名 `JSON.parse` 后构造 `GameContent`
  （`apps/shared/content/catalog.ts:GameContent`）并 `installGameContent(content)`。
- `ContentIndex` 的 `pets` 列出 10 个 `pets/*.json`；`PetDefinition.skills[]` 的每项
  `{baseId, initialRank, rankCap, levels, event, handler, target, condition}` 就是 `PetSkillDefinition`
  （`apps/shared/content/types.ts`）。等级技能 ID 由 `levels[rank-1]` 解析。
- `battle/pet-skill-rules.ts:readPetSkills` 从拥有基础记录读 petId（`+8`）、六个已学槽
  （`+0x44+4i` 的 baseId 与 `+0x5c+4i` 的 rank），经 `content.pets.get(petId)` 找到定义、
  按 `baseId` 匹配 `PetSkillDefinition`、取 `levels[rank-1]` 得到 `CombatSkillDefinition`，
  并把原规则 `{event, handler, target, condition}` 一并返回为 `LearnedPetSkill`。
  copy 来源（角色 combat `+0x88/+0x8c`）也经同一函数解析。仅当 `definition.event` 与
  `definition.handler` 存在时该来源才被解析。
- `battle/pet-lifecycle.ts:PetBattleSkills` 消费该来源：`hit/kill/death/respawn` 分别
  `dispatch(event)`，按 `source.rule.event` 取来源、`handlers[source.rule.handler]` 取处理器；
  `motion` 只派发 `event==='tick'` 的来源；`recipients` 按 `rule.target`（self/teammates/team）
  选择目标。现有处理器为 `attributes`、`heal`、`copy`。属性类来源安装到独立 `timed` 集合并经
  `attributeSkillIds()` 进入 `recomputeBattleAttributes`，不改当前 16 槽。

由此，`content.pets` 的规则表就是 10211/10231/10241 的真实路由选择器。

### 2.2 FuncType1 属性被动 → 角色重算

- `battle/attributes.ts:recomputeBattleAttributes` 是 World 面入口，分别调用
  `recomputeRoleAmmo`、`recomputeQualifiedRoleLife`、`recomputeQualifiedRoleMovement`、
  `recomputeQualifiedRoleArmor` 与完整 `recomputeRoleAttributes`。
- `roles/recompute.ts:recomputePrefix` 遍历 `selectRoleSkills` 结果，对每个技能调用
  `roles/recompute-skill.ts:accumulateRoleRecomputeSkill`；随后
  `roles/recompute-limits.ts:limitRoleRecomputeValues`（先上限后下限）与
  `convertRoleRecomputeValues`（百分比、两段装填、VIP MaxHP）写回。
- `roles/attribute-state.ts:RoleAttributeState.recompute` 把结果写入记录 `maxHp/maxBullet` 与角色 float 字段并触发通知。

### 2.3 FuncType1 定时/主动态专用消费者

- `battle/items/turn-drink.ts` / `speed-drink.ts` / `attack-drink.ts` / `defense-drink.ts`：
  校验 `skill.triggerType===1 && target===1 && functions[0].type===1`，用 `functions[0].t` 作为秒数，
  以 `attributes.ItemTurn` / `ItemMove` / `Atk`+`AtkBonus` / `Def`+`DefBonus` 建立临时技能或增益状态，
  到期/死亡/结束只移除本状态安装的技能。
- `battle/pet-lifecycle.ts`：`PetBattleSkills.handlers.attributes` → `receiveAttributeSkill` 安装原技能，
  `functions.find(type===1).t` 为秒数，`0xffff` 被动不通过；`conditionMatches` 的 `lowHealth` 读 `Func1.Z`
  作百分比阈值。
- `battle/pet-hit-speed.ts`（受击移动专消费者）：`applyPetHitSpeed` 经 `readPetSkills` 选择
  `event='hit' && handler='attributes' && target='self'` 且 `attributes.ItemMove>0` 的来源，读
  `functions[0].t` 秒数并安装到当前 16 槽；`advancePetHitSpeed`/`clearPetHitSpeed` 到期或死亡只移除本状态。
- `battle/pet-team-revenge.ts`（团队复仇专消费者）：`readQualifiedPetTeamRevengeSkill` 经 `readPetSkills`
  选择 `event='death' && handler='attributes' && target='teammates'` 的来源，`installPetTeamRevenge`
  按 `functions[0].t` 秒数安装到队友当前 16 槽，`advancePetTeamRevenge` 到期或死亡清除。
- `battle/items/ammo-slow.ts`：读被引用技能的 `functions[0].t` 秒数安装减速技能。
- `battle/items/ammo-radar-jam.ts`：命中目标建立独立 15 秒 `radarJam`；期限取 item 规则量，不改写
  4008 的 Func1/Radar 列。

### 2.4 FuncType2 生命增减专用消费者

- `battle/healing.ts:applyHealingItem`：`functions[0].type===2 && attributes.HP>0`，饲料 1/2 恢复量；
  经 `roles/food-healing.ts` 按 `HPRegainRate` 放大后 clamp 到当前上限。
- `battle/items/treasure-item-use.ts:applyTreasureItemUse`：只放行 20001/20002，走 `ItemSkill2` 30005 的
  Func2/HP30，与 Func20 拾取数量入账分离。
- `battle/items/medical-ammo.ts:resolveMedicalAmmo`：医疗弹 4007 的 `attributes.HP` 为治疗量。
- `battle/pet-lifecycle.ts:heal`（击杀回血 10211、团队回血等）：`handler='heal'` 读 `attributes.HP`。
- `battle/pet-kill-heal.ts`（击杀回血专消费者）：`healPetAfterKill` 经 `readPetSkills` 选择
  `event='kill' && handler='heal' && target='self'` 的来源（Pet2 10211），校验 `Trigger4/Target1/Func2/T0`
  后以 `attributes.HP`（40）走 `setBattleHealth`。
- `battle/items/equipment-supply.ts`：读 13171 的 `Func2/T=999`，`X` 为周期，`HP` 为恢复量。
- 伤害终端：空袭/地面爆炸/定时炸弹/爆发弹/死亡自爆等放置-爆炸链读被调用技能的 `Func2` 负 `HP`
  作为 direct HP 伤害（`ground-blast`、`old-bomb`、`airstrike`、`explosive-ammo`、`self-destruct`、
  `contact-mine`）。
- `battle/pet-lifecycle.ts:motion` 的 tick 恢复：读 `Func2.X` 为周期秒，`attributes.HP` 为恢复量。

## 3 仍未有 production caller 的支持输入

本树静态范围内，正常可达的 10211/10231/10241 已由 `content.pets` 规则 → `readPetSkills` →
`PetBattleSkills event/handler` 及第 2 节专用消费者完全覆盖；未发现新的、正常可达且未路由的
FuncType1/FuncType2 输入。不得因为 259 个 FuncType1 槽 / 41 个 FuncType2 槽中的存量记录而整体判为未接。

唯一保留的确切来源项是 item3006 引用的技能 4027：`skill.dat` 无该记录
（`unresolvedSkillReferences=[4027]`），原 writer/Func2/效果/声音缺失。该物件已有正常可达的采用业务
（category4 地面单次团队治疗，`healAmount=400`、`groundDurationMs=60000`、`triggerRadius=80`、
`runtime.trap='teamHeal'`、模型 00009，零价 `getMethod0` 不开放免费购买/不 gift），因此不把 4027
当作新的 production 缺口，也不补写源记录。

以下属于来源边界而非新增业务缺口，登记在 Known Issues：

- 原服务端“通用技能分派入口”（从角色动作读取技能、按 TriggerType/Target/Range 选目标并调用 func 的 writer）
  未恢复；本树各 FuncType1/2 入口都是按具体业务重建或采用，而非原 dispatcher。

## 4 建议下一批实现责任与最小文件清单

建议不再派发“通用 FuncType1/2 执行器”。若 root 要关闭 FUNC-01/FUNC-02，责任收敛为：

1. 宠物 Func1/2 来源入口已覆盖（`content.ts` → `definitions/*.json` → `readPetSkills` →
   `PetBattleSkills`/专用消费者），无需新增实现文件。
2. 取得侧（root/取证）：skill4027 原记录缺失保持开放；只在拿到原 writer/Func2 时新增，未拿到前
   维持 item3006 现有采用合同，不动已结源码。
3. 无未路由的正常可达宠物 Func1/2，故没有必须修改的文件；若后续取得原 dispatcher 或逐内容来源，
   仍按对应专题接入，不新增执行器/enum/迁移/wrapper。

已结范围不重做：饮料、饲料/治疗、医疗服务、宠物生命周期、弹药 2016、雷达、燃烧、减速、地面爆炸、空袭，
以及属性重算本身。

## Known Issues（来源精度 / 实测未满足，非代码缺口）

- 每个 FuncType1（259 槽）/ FuncType2（41 槽）逐槽的完整原语义、目标与授权未逐个枚举；
  本树只证明消费路径与已知入口，枚举与计数不属于本轮任务。
- 原服务端 dispatcher、Range/Target 原单位、FuncT 原单位与未知 X/Y/Z 用法未恢复；
  保留边界，不用相近编号或说明文字填补。
- VIP MaxHP 倍率 producer、DataScale 原写入者、部分绘声/声音原资源未恢复。
- 既有证据未覆盖真实双端、持久重启、高清；本轮不宣称实测或验收通过，父 tasklist 保持不变。
