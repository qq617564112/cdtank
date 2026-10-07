# 宠物治疗技能效果通知

`PetBattleSkills.heal` 在真实恢复生命后，于同一条 `playerHealed` 事件附带首槽 `playSkillEffect`，由既有客户端槽消费器读取技能表首槽的原声引用。这是重建 Web 服务端采用的发送契约；原服务端为宠物治疗技能发送 PlaySkillEffect 的成功条件仍未恢复，本文件不据此宣称还原。

## 触发与目标

通知随 heal 处理器的现有路由派发，不新增事件、第二槽或触发条件。大麦得意（10211）为击毁自用回血，各级均沿同一治疗路由；呀呼～打赢了！（10341）为击毁全队回血。处理器对全部等级与正常 copy 来源一致生效。

- 目标：`self` 只对施法者本人；`teammates` 只对模式 1–3 的同队非本人存活、状态 2、属性就绪的队友。目标选择沿用 `recipients`，模式 4／5 的非本人队友为空。
- 发送门禁：仅当实际恢复量 `restored > 0` 时附发；满血、拒绝与无恢复不发。

数值与生命公式不变：恢复量取该等级 `skills[levels[rank-1]]` 的 `attributes.HP`，经 `setBattleHealth` 夹取到当前生命上限后的真实差额。

## 首槽原参数

通知与事件使用同一技能表记录：`skillId` 为该技能表 ID、`effectIndex: 0`、`duration: 0`、`roleId` 由目标 `P<number>` 解析为数字角色 ID、`xBits: 0`、`zBits: 0`。是否发送由同一 `skill.effects[0].effectId` 决定：非零才附发，为零保持静默。大麦得意 1–5 级与呀呼～打赢了！首槽为 Effect11／Sound GA15／Tag0／Method3，附发；让我歇口气…（10831）首槽为 Effect0／Sound0，不附发。事件不在自身上携带施法者 roleId。

## 客户端消费

`BattleSkillEffects.event` 读取事件内 `playSkillEffect` 交给 `SkillEffectNotifications.play`。`roleId != 0` 分支查角色与 actor 后使用首槽原字段调用 `attached(role, effectId, 3, tag, oneShot)` 与 `sound(role, sound, 1, [0,0,-1])`；`duration: 0` 使 `retain=false`，效果与声音各单次触发，不进入保留或排队记录。角色离场经 `BattleSkillEffects.remove` → `clearRole` 清理该角色的保留／排队记录并复位角色效果，单次通知本身不留下记录。

## 验证范围

未执行本次通知的实际页面、联机、持久化或高清运行；首槽字段、目标与消费结论来自源码与已发布内容定义。既有大麦回血与队友传播的数值／生命周期证据属生命公式与路由范围，不作为本通知的实测证据。原服务端发包条件仍未知，浏览器端实际挂点／声音与全部等级／队友组合的表现待自然联机与页面验收。
