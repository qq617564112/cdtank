# 宠物技能触发效果通知

宠物属性的接受、击毁模仿与最后一搏建立三处真实成功后，各附发一次首槽 `playSkillEffect`。事件为独立的 `type: 'petSkillTriggered'`：`value: 0`、`playerId` 为施法源（拥有该宠物技能的玩家，自用技能即受益者本人）、`targetId` 为受益者、XYZ 取受益者当前坐标、`skillId` 为本次实际生效的技能表 ID。发送走既有的 `MsgRoomEvent.playSkillEffect` 字段与通用 Web 槽消费器，不新增 API 或 schema、不新增槽位或第二槽。原服务端这三处的发包成功条件仍未恢复，本文件只描述重建 Web 采用的发送契约，不据此宣称还原。

## 触发与目标

- 属性：`attributes` 处理器对每个受益者调用该受益者的 `receiveAttributeSkill`。仅当返回接受、且已把限时来源安装或刷新进 `timed` 时才发首槽通知。拒绝一律静默：施法或受益者已死／零 HP、无 Func1、Func1.T 无效（`<= 0` 或 `0xffff`）、以及较低等级被未到期的较高级同族来源拒绝。
- 属性目标：`self` 只对施法者本人；`teammates`／`team` 沿既有 `recipients` 选择，模式 1–3 的同队存活、状态 2、属性就绪受益者；模式 4／5 的非本人队友为空。每个实际被接受的受益者各发一次。
- 同级刷新：同技能家族、同技能表 ID 的重复接受仍安装刷新 `expiresAt`，并按一次接受发一次通知；较高级覆盖较低级同样按接受发送。通知不改变限时来源、`expiresAt` 与属性重算时序。
- 击毁模仿：`copy` 处理器仅在 `copyPassiveSkillAfterKill` 返回 `true`（即随机候选已选中、扩展字段 `0x88/0x8c` 已写入、原来源切换完成）之后发首槽通知。通知技能为模仿源本身的当前等级技能表 ID（如 10711），受益者与施法源均为复制者；被复制技能的激活不另发通知。来源冻结、copy 末序、候选集合、单次随机与清理逻辑不变。
- 最后一搏：首次合格致死使 `lastStand` 原 latch 建立后，用同一次选中的实际致死技能发首槽通知。`expiresAt`、治疗门禁、归属与最终死亡／复活链不变；重复 hit 因 `lastStand` 已置位在入口返回，不再通知。

## 首槽原参数

通知与事件使用同一技能表记录：`skillId` 为该技能表 ID、`effectIndex: 0`、`duration: 0`、`roleId` 由受益者 `P<number>` 解析为数字角色 ID、`xBits: 0`、`zBits: 0`。是否发送由同一 `skill.effects[0].effectId` 决定：非零才附发，为零保持静默。

- 属性与模仿源沿用各自实际生效的等级技能表 ID：宠物的六槽按 `levels[rank - 1]` 取当前等级，copy 源取受害者冻结选用等级经 `readPetSkills` 返回的 `skill.skillId`。首槽为 0 的被动（如 10131 好狗运 Effect0／Sound0）不附发。
- 10441 最后一搏首槽为 Effect43／Sound0／Tag0／Method3，`Func11.T` 3 秒与全部 attributes 0 不变，`runtime.retainedEffect` 保持 `false`；本通知不新增爆炸伤害、第二槽或保留效果。
- 10711 你会我也会首槽为 Effect12／SoundSE12／Tag0／Method3，`Func17` 模仿逻辑不变。

## 客户端消费

`BattleSkillEffects.event` 读取事件内 `playSkillEffect` 交给 `SkillEffectNotifications.play`。`roleId != 0` 分支查角色与 actor 后使用首槽原字段调用 `attached(role, effectId, 3, tag, oneShot)` 与 `sound(role, sound, 1, [0,0,-1])`；`duration: 0` 使 `retain=false`，效果与声音各单次触发，不进入保留或排队记录。角色离场经 `BattleSkillEffects.remove` → `clearRole` 清理该角色的保留／排队记录并复位角色效果，单次通知本身不留下记录。

## 验证范围

本三处通知未执行页面、联机、持久化或高清运行验收；首槽字段、门禁、目标与消费结论来自 owned 源码与已发布内容定义。既有的属性重算、模仿裁决、10441 零 HP 三秒存活／复活、治疗通知与队友数值证据属各自生命与路由范围，不作为本通知的实测证据。原服务端这三处发包条件仍未知，浏览器端实际挂点／声音与全部等级、队友与 copy 组合的表现待自然联机与页面验收。
