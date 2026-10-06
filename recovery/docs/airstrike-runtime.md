# 道具13空袭服务端运行时

FUNC-16/FUNC-15/item13的服务端实现记录。规则、采用政策与未知范围见 `airstrike-client-business-design.md`；本文只记录落地接线与当前范围。

## 接线

| 层 | 入口 | 行为 |
| --- | --- | --- |
| Shop | `apps/server/src/accounts/shop-catalog.ts` | item13 进入普通消耗品出售白名单，沿用原价40/20、GGet与durable字段。 |
| Kitbag | `apps/server/src/accounts/kitbag-configuration.ts` | item13 类别1可配置槽5–8；只更新现有 hotkeys，未改判定。 |
| 请求 | `apps/server/src/battle/items/item-request-dispatch.ts`、`accept-input.ts` | 普通 `useItem` 快捷槽5–8进入空袭入口；资格仍由实例、`status===2`、本局数量与输入sequence门禁决定。 |
| 施放 | `apps/server/src/battle/items/airstrike.ts` | 读取item13→13→3013→3012链；保存成功后再扣拥有/本局数量；以权威角色XZ为爆发中心。 |
| 在途 | `apps/server/src/rooms/state.ts` | 仅房间内部 `airstrikes` 数组保存 `ownerId/team/x/y/z/resolvesAt/sourceSkillId`，不进 snapshot。 |
| 结算 | `apps/server/src/world.ts` | 现有 step 在旧炸弹/接触雷结算链旁调用 `advanceAirstrikes`，到期后一次性范围选择并把3012交给 `damagePlayerDirectly`。 |
| 表现 | `apps/shared/protocols/MsgRoomEvent.ts`、`apps/server/src/world.ts` | 施放发 `itemUsed` 与 skill13 首槽 world effect；到期发 `airstrikeImpact` 与 skill3013 首槽 world effect。 |

`MsgRoomEvent.type` 为普通字符串字段，`playSkillEffect` 已有共用结构，因此本次未改动共享协议 union 或字段ID；`airstrikeImpact` 直接复用现有事件广播。

## tick 时序

`Func16 X20` 采用为20个服务器tick。`World` 在每次 `step` 记录真实 `deltaMs`，`updateInput` 据此把 `resolvesAt` 写为 `now + 20 * tickMs`，不硬写默认速率。到期只结算一次。

## 范围、目标与伤害

3013 的 `Target4/Range200` 采用闭方形 `abs(dx)<=100 && abs(dz)<=100`。合法目标为当前同房、`alive`、`status===2`、非施放者，且 `mode<=3` 时同队排除的角色。3012 的 `HP=-300` 转 `damage=300`，走现有 `damagePlayerDirectly`：直接扣整数生命，不走弹药暴击、装甲/饮料减伤、抵消或吸收，不生成 `shotPlayerResult`。命中记录 `hit`、`skillId=3012`、`value=300`；死亡、kill、score、队伍生命与mode结算沿统一死亡链。无敌期限未过时 `damagePlayerDirectly` 输出 `immuneHit` 且不改变生命。

## 生命周期

施放本身在保存成功后即消费；自然死亡、离场、终局、新局均不退款。施放者自然死亡不取消已排定轰炸；离房只删除本人 `ownerId` 的在途记录；`FINISHED` 与新局清空整个数组，已清空时序不再结算，不重放历史伤害。

## CPU

`apps/shared/combat/cpu-loadout.ts` 白名单加入 item13，槽5–8允许配置，数量上限由 `battleUseMax=1` 夹取（source cap1）。`apps/server/src/battle/cpu/items.ts` 新增有限策略：仅当CPU当前存活、`status===2`、已配置有限库存、中心200×200闭方形内有合法可见敌对威胁且当前不 `fire` 时，输出普通快捷输入槽号；不直接消费库存、不直接创建在途记录、不赠送库存，也未扩 item12/501 策略。

## 资源范围

已发布 `effect-library.json` 含 `_root\online\060`（3013 Effect60）与 `_root\online\010`（skill13 Effect10）节点，`audio.json` 含 `SE32`。服务端只发 world effect，不新增模型或声音资源、不以通用图形替代。

## 未执行的实际验收

本批未运行 unit test、浏览器、构建、类型检查、lint、exporter、native 或协议生成器，因此不声称端到端实测通过；上述接线与规则以静态实现为准。
