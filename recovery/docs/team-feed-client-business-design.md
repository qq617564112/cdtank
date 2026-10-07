# 精品饲料罐头团队治疗

对应M4-10-I3006。本文记录物件3006当前采用的普通地面团队治疗业务，以及它和缺失技能4027之间的边界。该业务由3006自身description、既有普通地面放置通道和明确Web采用值组成，不是4027原服务端技能记录的恢复结果。

## Source 事实

3006的真实定义位于`apps/shared/content/definitions/items/3006.json`：

- 名称：`精品饲料罐头`
- 原说明：`全队队友生命回复400。`
- `category = 4`、`kind = "trap"`、`itemType = 4`
- `inventoryCategory = 2`、`battleUseMax = 10`
- 价格`0/0`、`getMethod = 0`、Shop不可用、CPU不可用、交易值`0`
- `appearanceEffect = false`
- `runtime.skillRoles.primary = 4027`，`unresolvedSkillReferences = [4027]`
- 三个item effect槽均为`effectId = 0`、`sound = "0"`，没有可据以播放的4027效果或声音
- 视觉保持原`model = "Data/scnobj/00009/00009.glb"`、`modelId = 9`、`iconId = 9`

3006的400点恢复来自其原说明。4027当前仍missing/unresolved，不新建4027记录、Func2、技能槽、特效或声音，也不通过相近技能编号替代。

## Web 采用

以下规则是Web采用，不是4027原writer字段的直接恢复：

- 地面接触半径采用XZ 80。
- 地面期限采用60000 ms。
- 每个地面对象最多触发一次。
- mode1..3允许owner或当前同队合格目标进行初始接触；首次有效接触后，选择触发瞬间当前room全部合格owner/同队目标，不再限距。
- mode4/5仅owner可接触和接受治疗；其他玩家即使拥有相同team数字也不视为本规则下的友方。
- 满血、lastStand、死亡、非status 2或hp不大于0的接触不会触发治疗，地面对象继续等待有效接触或到期。

## 放置与取得边界

普通请求从已有合法owned实例进入现`category4` placeTrap路径，并沿现有账户CAS事务处理：

1. 实例、战斗状态和请求前置条件通过。
2. 账户CAS先成功。
3. `ownedQuantity`与`battleQuantity`各减少1。
4. 使用definition/model 9创建地面对象。

CAS失败或抛错时不扣数量、不创建对象。价格字段为0不授权免费BUY、gift、CPU自动配给或交易取得；零价仅保留原definition literal，不构成新的取得来源。3006的原始购买、掉落、奖励或账户发放链仍未知。

触发、到期、owner离房、清理或回合结束均不退款，也不再次扣除库存或本局数量。多个3006对象彼此独立，每个最多完成一次触发。

## 治疗权威

放置后的地面状态由普通ground路径推进。`apps/server/src/world.ts`的两个`advanceGroundTraps`调用点都提供同一种治疗回调，不能只接通其中一个推进路径。`apps/server/src/battle/items/ground-traps.ts`只负责接触、目标选择、对象生命周期和事件；生命上限、真实写入与统计由World提供。

`canHeal(target)`要求：

- 角色真实`alive`
- `combat.status === 2`
- `hp > 0`
- 非`lastStand`
- `hp`小于角色实际maximum

maximum沿现有World政策计算：

- VIP目标：`Math.max(1, room.map.vipHp)`
- 普通目标：现有三级`playerMaxHp(target)`

治疗使用同一maximum调用`setBattleHealth(target, value, maximum)`，其中`value = Math.min(maximum, before + amount)`。返回值为写入后的真实生命差额，不把规则量400直接冒充实际恢复量。`apps/server/src/battle/round-statistics.ts`的`recordHealing(owner, restored)`只接受mode1..3中真实非self同队的实际恢复量；owner自疗和mode4/5治疗均不统计。

## 触发与事件

- 首次有效接触只发一次`trapTriggered`，保留原owner身份和真实接触者，`value = 400`表示item规则量。
- 随后对每个真实`restored > 0`的目标发一次`playerHealed`，`playerId`为原owner，`targetId`、坐标和`value`来自真实目标与实际恢复量。
- 不从该地面对象发送`shotPlayerResult`，也不发送没有来源的4027 `playSkillEffect`、技能槽效果或声音。
- 触发完成后移除该地面对象。两个advance调用路径不会再次消费已经移除的对象。

## 生命周期

- 60000 ms到期时按普通地面规则移除，不退款。
- owner离房时移除其未触发3006地面对象，不退款。
- `clearGroundTraps`在finish、newround及现有清理边界移除对象，不退款。
- owner仍在room但死亡时，3006保持普通地面寿命；不新增3007式死亡删除规则，死亡角色自身也不具备治疗资格。
- 不改变3007及其它ground content的既有生命周期或路由。

## 表现

现有`GroundTrapsPresentation`按definition和model 9进入`ContentItemVisual`，沿用原`Data/scnobj/00009/00009.glb`视觉。既有snapshot传递地面状态与真实生命值，既有`playerHealed`消费者处理恢复反馈。本采用不新增UI、协议字段或共享schema，也不构造无来源的4027特效或声音。

## Limitations

- 4027原writer、Func2、字段效果、原触发条件及目标语义仍未恢复。
- 3006的原始取得来源、购买/掉落/奖励链路仍未恢复。
- 80接触、60000 ms寿命、单次触发、mode目标选择和400治疗量中的非source部分是明确Web采用，不宣称为原服务端逐字段等价。
- 真实页面、普通联机对局、双端事件、HD资源、持久重启和真实VIP maximum仍未实测。
- 代码走查只覆盖静态结构与合同一致性，不能替代上述实测或原始来源。
- M4-10-I3006、FUNC-02及M4-10父项保持未勾；3007、AP、AQ及其它既有结论不因本业务改变。
