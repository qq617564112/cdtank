# M2-01 普通炮击 Critical 客户端与权威合同

## 结论

当前真实 battle 源已经有普通 Critical 判定，不是只有展示字段或预置标志：

- 服务端从当前角色、装备和技能重算 `combat.roleFloatFields[0x68]`。
- 敌对非同队同人、带已确认 `ammoItemId` 的命中在友伤、无敌和攻击抵消门禁之后读取该来源。
- 服务端执行一次随机判定，把结果写回本次伤害，并在正式 `hit` 事件中发送 `shotPlayerResult.critical`。
- 客户端不提交 Critical 请求或结果，只消费服务端事件；现有 Web Critical 字体和原附图消费者已足够。

因此本项不需要新增协议字段、服务器规则、UI consumer 或重复实现。剩余缺口只在原服务端概率/倍率公式和完整原视觉范围。

## 当前规则

| 边界 | 当前生产合同 |
| --- | --- |
| 来源资格 | `attacker.alive && attacker.attributesReady`；读取 `combat.roleFloatFields.get(0x68)`。缺失或 `<= 0` 时不随机、不倍乘、`critical=false`。 |
| 命中范围 | 仅 `ammoItemId !== undefined` 的敌对、非同队、非同人命中。友伤、无敌和反应装甲抵消先返回；医疗弹和周期伤害不走该判定。 |
| 随机位置 | 在 `damagePlayer` 的命中事务内执行一次 `Math.random()`；条件是当前归一化比例严格大于该值。动态炮弹在实际命中时读取攻击者当前资格，不在开火时冻结。 |
| 伤害顺序 | Critical 为 true 时先把本次 shot damage 乘 2，再进入目标的正面/侧面/背面防御计算。最终 HP 仍走现有 `setBattleHealth` 整数赋值与限幅。 |
| 通知 | 同一个 `hit` 事件带 `shotPlayerResult: {itemId, critical}`；`itemId` 由权威命中链冻结。`critical=false` 也公开，不用缺少字段表达非暴击。 |
| 客户端 | Web 只读取 `event.shotPlayerResult.critical === true`，选择 Critical 队列；否则选择普通 Damage 队列。`hurtSelector` 只控制受击动作，不替代 Critical。 |

## 准确代码与来源

- [recompute-base.ts](../../apps/server/src/battle/roles/recompute-base.ts)：原 `4334e8` 来源把拥有记录 `+0x34` 初始化到 role float `+0x68`。
- [recompute-skill.ts](../../apps/server/src/battle/roles/recompute-skill.ts)：原 `432951` 把当前技能 `Critical` 属性按倍率累计到 `+0x68`。
- [recompute-limits.ts](../../apps/server/src/battle/roles/recompute-limits.ts) 与 `convertRoleRecomputeValues`：DataScale id 5 先限幅，原 `433c55` 出口把 `+0x68` 按 `f32(0.01)` 转为当前比例。
- [shot-critical.ts](../../apps/server/src/battle/shot-critical.ts)：要求存活和当前来源合格，执行一次随机判定并调用 pure critical 计算。
- [qualified-shot-critical.ts](../../apps/server/src/battle/roles/qualified-shot-critical.ts)：`critical = qualifiedRate > roll`；true 时 `attack = rawAttack * multiplier`。当前生产传入倍率 2。
- [life.ts](../../apps/server/src/battle/life.ts)：固定 friendly / immune / counter 门禁顺序，Critical 在目标 facet 防御前应用，并把 `critical` 写入 `hit.shotPlayerResult`。
- [world.ts](../../apps/server/src/world.ts)：命中链保留权威 `itemId`，不向客户端新增另一条 Critical 请求。
- [MsgRoomEvent.ts](../../apps/shared/protocols/MsgRoomEvent.ts) 与 `serviceProto.ts`：正式事件字段为可选 `shotPlayerResult.critical`。
- [battle.ts](../../apps/web/src/match/battle.ts)、[battle-players.ts](../../apps/web/src/render/battle-players.ts)、[tank-damage-text.ts](../../apps/web/src/assets/tanks/tank-damage-text.ts)：Web 将服务端布尔值路由到普通或 Critical `TankDamageText`。

原客户端消息身份见 [actor-critical-combo-presentation-gap.md](./actor-critical-combo-presentation-gap.md)：原 shot-player message `+0x14` 的 one-bit Critical 选择 selector2，false 选择 selector1；两种分支都使用同一 signed damage。该来源证明分类和字体 selector，不提供服务端概率或倍率。

## Web 采用与限制

当前概率解释、单次 `[0,1)` uniform 和倍率 2 是明确 Web 采用，不是原服务端完整公式。原 `0x14` Critical 位也没有给出抽样、倍率和防御顺序；这些必须继续列为 M2-01 的真实来源缺口。

为避免扩大范围：

- 保留现默认概率来源和倍率；没有新来源时，不新增默认非零 Critical、不添加客户端请求字段、不注入固定 RNG。
- 不把相同回合宠物技能的背面条件伤害并入本 Critical 判定；其现行同击消费是独立来源，不能证明原概率/倍率。
- 不是原服务的完整等价声明；有限双端普通/Critical 样本不证明分布、全部弹药、全部车型或原 GPU 像素。
- 原 CEGUI `font+bc` 实时度量、原 GPU 逐像素一致性、Combo 生产资格以及所有技能/弹药条件仍归父项。

## Owned 建议

`core`：无生产改动。保留现 `shot-critical.ts → qualified-shot-critical.ts → life.ts → MsgRoomEvent` 权威链；未来只有取得明确原概率或倍率来源时才替换当前 Web 采用，并保持客户端只读结果。

`UI`：无新增。现 `battle.ts` + `TankDamageText` / `TankCriticalTextRenderer` 已消费正式布尔值并选择原 Critical 显示分支。

本项最高合同是维持当前有限生产入口，不新增实现或验证范围；原概率/倍率、完整自然统计与 GPU/字体等价继续保持未完成。
