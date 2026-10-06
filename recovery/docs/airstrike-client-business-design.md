# 道具13空袭正式客户端业务设计与服务端实现合同

FUNC-16/FUNC-15/item13。本文从已保存的 item/skill 原表、原 `UMsgSkBomb` 接收器、已发布 combat 目录、现有 world effect consumer，以及现有目标、生命、房间事件和库存模块建立正式实现合同。原服务端权威执行入口仍缺，因此本文明确区分直接源事实与采用的 Web 业务规则。它不声称原客户端执行等价，也不把未知字段补成已恢复语义。

## 直接源事实

| 范围 | 原来源事实 |
| --- | --- |
| item13 | ItemTableID 13“救命啊通讯器”；ItemMoney 40、ItemCoin 20、GGet 2、Durable 5、Break 0、BattleUseMax 1、ItemSkill1 13；说明为请求空中支援并对该地区地毯式轰炸。 |
| skill13 | TriggerType 1、Target 1、Range 200；FuncType16/T0/X20/Y3013/Z0；首效果 Effect10/SE02/Tag0/Method3。 |
| skill3013 | TriggerType 1、Target 4、Range 200；FuncType15/T0/X0/Y3012/Z0；首效果 Effect60/SE32/Tag0/Method1。 |
| skill3012 | TriggerType 1、Target 1、Range 0、HP-300；FuncType2/T0/X0/Y0/Z0；无效果与声音字段。 |
| 引用链 | `item13 ItemSkill1 -> skill13 FuncType16 -> FuncY1 skill3013 -> FuncType15 -> FuncY1 skill3012`；表 loader 以四字节槽步长读入 skill+158/+164/+170/+17c/+188。 |
| 原接收器 | `UMsgSkBomb` type416f→486a09；消息含 skillId、从零开始的 effect slot、`+14` 的 float32 XZ 点数组。每点八个字节，经向零截断后调用 world sampling，效果使用采样 X/Z、提交 Y=0、flag1。 |
| 原接收器边界 | 486a09 不读 FuncType，不写目标生命，不分配 trap，不扣库存；它是已定位的 world-effect 入口，不是 Func16/Func15 权威执行器。 |
| 已有消费者 | skill13 首槽 roleId0 已由正式通知消费者表达为原 Effect10 world 树；原 010 八绘制节点、视锥外不创建、独立 world 生命周期及显式停止清理已有验证。 |
| 原缺口 | 416f 发送者及 `+14` point vector 的位置/数量来源未确认；Func16/Func15 权威分派、3013→3012 的实际调用和 3012 HP writer 未确认；X20 的单位、数量与时序未确认。 |

以上字段保持原值。已发布 `combat-catalog.json` 已包含 item13 与 skill13/3013/3012；实现只读取，不改目录字段。

## 采用业务规则

普通请求合同沿用已确认的 `43d4dc` 路径：玩家在准备阶段正常取得 item13 并配置到物品快捷槽，战斗中普通自用只发送拥有实例 ID。请求不带目标坐标、范围、伤害、次数或调度参数；服务端从当前认证角色和原表求值。

### 取得、配置与消费

1. item13 的两个原价格均为正，沿现有普通 Shop BUY 事务与确认规则开放。正式目录新增 13；不因 GGet 2 开放免费取得，不预置隐藏库存。
2. item13 的 inventory 分类为类别 1。Home 物品页配置槽 5–8，战斗对应普通输入 5–8；不使用武器槽 2–4，也不走 `placeTrap`。
3. 施放前置条件沿用现有物品业务：`PLAYING`、本人存活、`status===2`、拥有实例真实存在、`ownedQuantity>0`、该局 `battleQuantity>0`。
4. 成功时先按现有 CAS 保存库存再扣本局数量；保存失败或数量竞争不施放、不扣本局数量、不产生命中。每局初值由 `BattleUseMax=1` 与现 `initializeBattleQuantities` 夹取。
5. 每次成功后发布一次 `itemUsed`，`skillId=13`、`itemTableId` 由实例确认。未命中任何角色仍算一次已确认施放并消耗，因为表链定义的是请求一次区域轰炸，而不是“命中才扣”。

### 目标坐标采用政策

普通请求没有 vector。采用“请求者的权威角色 XZ 为轰炸中心”，不回传客户端坐标，不从炮口或 look 增加偏移。

该选择与已知合同相容：skill13 为 Target1，请求者是权威作用对象；已恢复的 416f 接收器只消费整数 scene XZ 世界点，尚不能证明原 sender 如何把角色位置/方向转成 point vector。采用请求者 XZ 可避免把未确认的 forward 距离或炮口偏移写成原规则。若后续找到原 sender，可只替换 center 计算而不改事件、范围、伤害和生命周期合同。

### 3013/3012 与范围、伤害

采用以下一次性区域结算：

1. skill13 的 X20 解释为“普通施放确认后等待 20 个服务器 tick”。默认 `TICK_RATE=20` 时为约 1 秒；实现保存 `resolvesAt = now + 20 * tickMs`，不以客户端时间触发。
2. 该选择只采用 X20 的一个可实施时间单位，不把 X20 解释为 20 次、20 发、20 个炸弹或 20 波。原 X20 未证前，`20` 不直接作为固定毫秒数，也不循环。
3. 到期时对中心做一次 skill3013 范围选择，随后调用一次 skill3012 直接生命减量。`Target4/Range200` 沿 3009 同字段的既有 Web 重建，解释为 XZ 轴对齐正方形：中心差 `abs(dx)<=100 && abs(dz)<=100`，边界包含。
4. 3012 的 `HP=-300` 产生 `damage=300`，只命中一次；不生成多波、不按 X20 重复伤害。
5. 合法目标为当前同房、`alive`、`status===2`、敌对且非施放者的角色。`mode<=3` 时同 team 始终排除；混战与破坏模式的其他参与者按敌对处理。已无敌期限未过时不改变生命。
6. 生命作用沿现有 `damagePlayerDirectly`：直接扣整数生命，不走 ammo Critical、facet/饮料防御、抵消、反装甲或 HP 吸收，不生成 `shotPlayerResult`。命中记录 `hit`，`skillId=3012`，`value=300`；最终死亡、kill、score、队伍生命与 mode 结算沿统一死亡链。
7. 施放者自然死亡不取消已排定轰炸；`FINISHED` 或 `newround` 清除待结算时序，不结算已清除时序。成功施放本身已消费，退出、终局或新局不退款。

以上 20 tick、200×200 闭方形、单次 300 直接伤害是采用的 Web 重建政策。tradeoff 是它可能不等于未知原调度；它优先保证字段保留、无 X20 猜填、可执行与可替换，而不是假称原执行等价。

### 表现、事件与生命周期

1. 成功施放立即发布一次普通 `itemUsed`，并同时发布 skill13 首槽 world effect，使用 `roleId=0`、`effectIndex=0`、`duration=0` 与中心 XZ 的 float32 bits；复用现有 010 consumer，不新增资源。
2. 到期范围结算发布一次正式 `airstrikeImpact` 事件，`skillId=3013`、中心 XYZ 与 `playSkillEffect={skillId:3013,effectIndex:0,roleId:0,xBits,zBits}`。该事件复用现有通知 consumer 与已发布 Effect60；若目录没有可确认的 060 发布资源，则不伪造资源，也不宣称实际绘制。
3. 3012 是末端直接伤害，不额外产生第二效果或声音；命中事件只记录 skillId/value。
4. 不新增 `SkillEffect` 类型、不造 `xBits/zBits` 新协议字段、不把 `MsgRoomEvent` 扩成通用调度框架。复用现有 `playSkillEffect` 与 room event 广播。
5. 重连和重开页面不从 snapshot 重放已经发生的 010/060 瞬时效果，也不从 snapshot 重发伤害。活动时序只保存在服务端房间状态并继续推进；重连玩家恢复权威生命、库存和后续事件，不新增 `MatchSnapshot` 活动时序字段。短暂视觉在断线期间不可见是明确 tradeoff，不把历史效果当权威状态重放。

## 服务端接线

服务端按以下归属完成本功能；普通 Shop、Kitbag、World、Life、RoomEvent 的既有事务顺序保持不变，combat catalog 的字段值未改。

- `apps/server/src/accounts/shop-catalog.ts`：item13 进入普通消耗品出售白名单；继续使用原正价、GGet 展示字段和现有 Shop 事务，无免费路径。
- `apps/server/src/accounts/kitbag-configuration.ts` 与 `apps/server/src/battle/preparation.ts`：item13 类别1可配置槽 5–8，确认后只更新现有 hotkeys。
- `apps/server/src/battle/items/item-request-dispatch.ts` 与 `apps/server/src/battle/accept-input.ts`：普通 `useItem(13)` 接到 airstrike 入口；仍由实例查找、status、battleQuantity 和 sequence 门禁决定请求资格。
- `apps/server/src/battle/items/airstrike.ts`：独占 item13 规则读取、X20→20 tick 采用、中心、单次范围选择、3012 伤害调用与 airstrike 专用事件构造。
- `apps/server/src/rooms/state.ts`：仅增加本房间内部的最小在途数组 `airstrikes`；不进入 `MsgRoomSnapshot`，不新增共享协议字段。
- `apps/shared/protocols/MsgRoomEvent.ts`、`apps/server/src/world.ts`：复用现有 `MsgRoomEvent`/`playSkillEffect`；World 在现有 step 中调用 `advanceAirstrikes`，并把 3012 交给现有 `damagePlayerDirectly`。

运行时接线与范围记录见 `airstrike-runtime.md`。

## 必需字段与接线摘要

| 层 | 字段/入口 | 实现行为 |
| --- | --- | --- |
| Item | `itemTableId=13` | 正常 Shop BUY、拥有实例、可配置槽 5–8；`battleUseMax=1`。 |
| Request | `ItemUseRequest.kind='useItem'`, `instanceId` | 只传拥有实例；服务端求目标。 |
| Cast | `itemUsed`, `skillId=13`, XYZ | 成功 CAS+数量扣减后一次发布。 |
| Pending | 房间内部 `ownerId`, `team`, `x/y/z`, `resolvesAt`, `sourceSkillId=13` | 仅服务端状态；`resolvesAt=now+20*tickMs`，不进 snapshot。 |
| Area | `skillId=3013`, center XYZ, `range=200` | 采用闭方形 `abs(dx/dz)<=100`；一次。 |
| Damage | `skillId=3012`, `damage=300` | 敌对 non-self/alive/status2 且未无敌；走 direct HP。 |
| Effect | `playSkillEffect(skillId=13/3013,effectIndex=0,roleId=0,xBits,zBits)` | 复用现有 world consumer；不补缺失资源。 |
| Persistence | 现有 inventory CAS | 成功消费持久；不写目标 HP、不写客户端坐标、不新增退款。 |

## 明确未知与采用规则

| 未知 | 采用规则 | Tradeoff |
| --- | --- | --- |
| X20 单位、数量、调度 | 20 个服务器 tick；单次结算，不按 20 波或 20 发。 | 可能不等于原时间，但不把未知字段当次数。 |
| 416f sender 的点数组与位置来源 | 请求者权威 XZ；不推断 look/炮口偏移。 | 可能缺少原前向落点，但可由替换 center 计算修正。 |
| Func15/3012 权威调用与 HP writer | 到期一次直接 3012 伤害；`-300` 转 `damage=300`。 | 不声称原执行器等价，但复用现有统一生命链。 |
| Target4/Range200 几何 | 沿同字段 3009 的 Web 政策采用 200×200 闭方形。 | 原目标查询未恢复，可能不是通用圆形选择。 |
| 3013 首槽 Effect60/SE32 资源与时序 | 复用现有 consumer；已发布资源直接消费，不造模型/声音。 | 时序仍沿采用政策，可能只完成一次 060 绘制与命中。 |
| 重连历史瞬时效果 | 不扩 snapshot 保存时序，不重放历史 010/060/命中；只恢复生命/库存及后续事件。 | 断线期间短暂视觉不可见，但在途结算仍由服务端完成。 |

## 范围边界

不新增 unit test、不运行 tests/浏览器/构建/类型/lint/exporter/native/协议生成器。不新增通用技能调度框架、哈希、防护层、兼容包装或免费取得路径。已发布资源存在时不造替代；缺失时只保留资源缺口，不用替代资源掩盖。
