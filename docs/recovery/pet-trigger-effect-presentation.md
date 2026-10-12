# 宠物技能触发效果呈现

本批把宠物技能取得资格后的首槽视觉与声音作为独立 `petSkillTriggered` 事件送达 Web。事件复用现有 `MsgRoomEvent`、`BattleSkillEffects.event`、`SkillEffectNotifications.play` 与通用 TankView 效果 runtime，不新增协议字段、API、缓存、Replay 或界面控件。

## 事件合同

Web 采用的事件字段如下，原服务端相同 producer 尚未恢复：

| 字段 | 值 |
| --- | --- |
| `type` | `petSkillTriggered` |
| `value` | `0` |
| `playerId` | 实际技能来源玩家 ID |
| `targetId` | 实际接收效果的受益者玩家 ID |
| `x`、`y`、`z` | 受益者的权威位置 |
| `skillId` | 当前来源实际使用的 rank 技能表 ID，不是 base ID |
| `playSkillEffect.skillId` | 与事件 `skillId` 相同 |
| `playSkillEffect.effectIndex` | `0` |
| `playSkillEffect.duration` | `0` |
| `playSkillEffect.roleId` | 由受益者 `P<number>` 解析出的数字角色 ID |
| `playSkillEffect.xBits`、`zBits` | `0` |

`playSkillEffect` 仅在技能表 `effects[0].effectId != 0` 时发送。首槽为零时不发送本批呈现通知，也不发送空的视觉记录。`value`、`playerId` 与事件 XYZ 不参与附着坐标计算；数字 `roleId` 决定附着到哪个 TankView。

## 客户端路径

`BattleMatch` 的 `RoomEvent` 消费者调用 `BattleSkillEffects.event(event)`。该方法不按 `event.type` 分支，只要事件带有 `playSkillEffect`，就原样交给 `SkillEffectNotifications.play`；`stopSkillEffect` 仍只处理既有保留效果。新事件因此沿现有首槽消费者呈现。

`BattlePlayers` 在 `TankView.load` 完成后把 view 放入玩家映射并调用 `EffectRuntime.attach(view)`。`createSkillEffectNotifications` 的 `role(roleId)` 再通过 `P<roleId>` 读取该映射：

1. `SkillEffectNotifications.play` 查 `catalog.skills[skillId].effects[0]`、目标角色和未销毁 actor。
2. `duration: 0` 使 `retain=false`；本批技能的 `runtime.queuedEffect` 与 `runtime.retainedEffect` 均为 `false`，所以既不进入角色保留表，也不进入部件队列或定时切换。
3. 通用 runtime 以固定绑定参数 `3`、首槽 `tag` 和一次性标记调用 `spawnAttachedEffect`。它读取 `view.primaryTag(tag)`，再按 `_root\online\<三位 effectId>` 查找并挂载通用效果树。
4. `sound(role, effects[0].sound, 1, [0,0,-1])` 沿 TankView 当前位置播放首槽原声音引用。

`effects[].method` 仍是未消费的来源字段。当前消费者不按 method 分派，绑定模式由通用通知路径固定传入 `3`。本批同样不读取第二、第三槽，不添加爆炸伤害或 retained 状态。

若通知早于目标 TankView 载入、角色不存在、actor 已销毁、首槽 effectId 为零或通用效果资源缺失，消费者不会补发、缓存或稍后重放。事件到达时即可消费；TankView 载入只建立后续事件的附着目标。

## 业务呈现规则

属性受益者只有在 `receiveAttributeSkill` 实际接受并安装或刷新 timed 来源后，才以该来源当前实际技能 ID 发送一次首槽通知。较低级来源被未到期较高级拒绝、目标死亡、HP 为零、没有有效 Func1 或没有有效 T 时均不发送。同级被接受并刷新时发送一次。

模仿只在 `copyPassiveSkillAfterKill` 返回 `true`，且复制来源已切换到复制者之后发送。事件目标是复制者，使用模仿技能 10711 的真实首槽，不发送被复制技能的激活，也不改变候选、随机、来源冻结、copy 处理顺序或清理规则。

首次合格最后一搏建立原 `lastStand` latch 后，发送同次实际选中致死技能的首槽通知，目标为 HP 为零但仍 `alive` 的玩家，`duration` 为 `0`。重复 hit 不再次发送，呈现路径不改变 `expiresAt`、治疗门禁、最后一搏归属、最终死亡或复活。技能 10441 的首槽为 Effect43、sound0、tag0、method3；不发送第二槽，不新增爆炸伤害或 retained 效果。

死亡技能事件的 `playerId` 是技能来源，`targetId` 与 `playSkillEffect.roleId` 是存活受益者；消费者只按 `roleId` 附着，不会把效果改挂给死者或事件源。复活只由实际复活 producer 产生；`BattlePlayers` 在权威 snapshot 的 `alive` 从 `false` 变为 `true` 且部件队列未接管时调用既有 `revive`，该入口不合成新的宠物触发事件。

治疗继续使用既有 `playerHealed.playSkillEffect`，保留原 `recordHealing` 与首次发布合同；本批不重复发送治疗首槽，也不迁移治疗记录。

## 范围边界

已有的宠物死亡视觉、部件队列和复活队列属于既有路径，本批不修改。文档结论来自上述协议的 Web 消费规则、runtime 与玩家生命周期源码，以及已发布内容定义；它不把源码说明当作页面或自然联机实测。原服务端 producer、EffectMethod 分派、实际资源挂点和声音表现仍待真实 producer 与页面验收。

## 指挥绘声

10541的有效指挥来源按受益角色合并：首次获得时单次通知首槽Effect102/SE34，最后来源撤回且受益者仍active/alive/status2/attributesReady时单次通知第二槽Effect104/SE36。模式1–3包含同队来源，4/5只有本人真实来源；多来源、重复tick和换caster不重播，自己的死亡／finish／round／Leave只清状态。World沿active tick调用reconcileCommandEffects，copy或来源死亡／离房在下一tick反映，数值传播和原三处首槽通知保持。采用时点、完整消息及限制见[remaining-effect-slot-integration.md](remaining-effect-slot-integration.md)；原两槽时机／受益者分配和新增实测继续开放。
