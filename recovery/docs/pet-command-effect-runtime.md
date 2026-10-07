# 宠物指挥效果运行时

技能10541（指挥）按受益者合并真实来源，首次获得与最后来源撤回时各单次通知一个效果槽。通知沿现`MsgRoomEvent`、`petSkillTriggered.playSkillEffect`与共享`BattleSkillEffects`/`SkillEffectNotifications`消费者消费，`MsgRoomEvent`无新增字段。

## 技能与效果

宠物5（猎师）与宠物105（猞猁）的开放学习槽均选择base10541／rankCap1，实际技能为10541。首槽Effect102／SE34／tag0／method3，第二槽Effect104／SE36／tag0／method3；`runtime.retainedEffect=false`、`queuedEffect=false`，通知按duration0单次，不进入保留或队列语义。

本人来源保持原属性作用范围（Critical4／Lucky8，全五模式本人），不新增队伍属性传播；非本人同队传播只走模式1–3现`refreshTeamSkills`路径。数值、来源队伍、计数、复制资格、已学rank与lifetime不变。

## 调用路径

World在现`simulateRoom`模拟tick内对每个玩家调用`PetBattleSkills.reconcileCommandEffects(events)`，不新增tick、定时器、轮询、队列或transport。`commandEffectSource()`先读本人`readPetSkills`（含合法copy）中`skillId===10541`、`event==='passive'`、`target==='team'`的来源；模式>3时不再读队友，模式1–3按房间顺序取同队alive／status2／attributesReady的同类来源。

受益者需active、alive、status2且attributesReady（`live()`）。多个有效来源合并为一个有／无指挥资格，同id多来源只算一次；呈现状态只保留先前`skillId`与`casterId`字符串并更新当前实际caster，不持额外player引用。

## 生命周期与事件

- 无→有：首次获得有效资格时置呈现状态并push一次首槽`petSkillTriggered`，`playSkillEffect`为effectIndex0／duration0／真实numeric roleId，XYZ为受益位置，xBits/zBits0。
- 持续存在：重复tick、刷新、换caster或同id多来源均不重播；source替换只更新呈现caster。
- 有→无：最后一个来源撤回且recipient仍live时，先清呈现状态，再push一次第二槽（effectIndex1／duration0）。
- 撤回边界：source死亡／Leave在下一active tick反映，仅对仍存活合格recipient撤回；copy替换按现合同重算。
- 只清理：recipient自己的死亡／Leave、finish／round、换局经现`clear`/detach路径reset呈现状态，不播结束；新生命或新局沿真实资格重新建立首槽。
- 事件字段：playerId为实际来源caster，targetId与numeric roleId为受益者，skillId10541，value0。

## 来源边界与未实测

获得／撤回时点及受益者绘声分配为项目采用；原两槽触发producer与时机仍未恢复，也不声称已恢复。当前交付仅为源码接线，本批唯一集中代码走查尚未完成，未运行测试、浏览器、构建、类型检查、原生取证或音频播放。普通对局、双端绘声、清理、高清与持久实测仍未取得，tasklist对应父项与其具名子项保持未勾。
