# 爆发弹与自爆部件客户端表现

本文登记4004与13151在当前Web battle中的事件消费、图声归属和保留边界。来源字段与server规则见`blast-skill-client-business-design.md`及`blast-skill-runtime.md`。

## 事件入口

`apps/web/src/match/battle.ts`在现有room event回调中把每个已接收`MsgRoomEvent`交给`BattleSkillEffects.event(event)`，不依赖snapshot重放domain事件。domain事件的`playSkillEffect`进入既有roleId0 world tree，事件XYZ使用真实payload。

4004与13151均复用现有`MsgRoomEvent.type`、`hit`、`playSkillEffect`字段和`BattleSkillEffects`，没有新增Web协议字段或本地预测伤害。

## 2005命中表现

普通2005玩家命中仍先沿`hit`事件更新`BattlePlayers.damage`、Critical值、原伤害数字图片与hurtSelector/hurt。`shotPlayerResult.itemId=2005`来源字段保留，但2005 hit呈现分支不再调用旧附着4004的`TankShotPlayerResult.showPlayerResult`，避免与权威`explosiveAmmoBlast`重复播放Effect9/SE32。

该抑制只覆盖旧2005附着4004图声。其它ammo的受害者结果消费者、2005 scene result、其它raw通知、生命业务和scene/crush消费者不变。

## 世界图声

`BattleSkillEffects.worldSound`只对现有已确认的roleId0事件按skillId接世界声音：`itemUsed`13、`airstrikeImpact`3013和`explosiveAmmoBlast`4004。4004只接受`effectIndex=0`，并从事件XYZ调用既有`worldSound`后端；后端按skill4004首槽原sound字段播放一次SE32世界WAV。

世界Effect9由`playSkillEffect`的roleId0分支进入现有consumer，4004事件不重放snapshot，不本地创建第二条效果。`selfDestructBlast` skill13151的sound0保持静默；terminal19的hit不带Effect/Sound；其它raw roleId0通知仍静默。

现有音频runtime继续负责音量、空间位置、自然结束以及round、Leave、scene、资源重载清理；本片不新增独立声音owner、不复制WAV、不改变字体、原伤害数字图或FX其它分支。

## 保留消费者

- 2005基础hit：原baseDamage、Critical、facet、hurt、伤害数字和`shotPlayerResult`来源字段。
- 4004末端19：既有`hit(skillId=19,value=100)`，服务端direct HP-100，客户端静默。
- 13151末端19：同一terminal19命中与生命反馈，sound0静默。
- 4004 domain：一次Effect9 world tree与一次SE32世界WAV。
- 13151 domain：一次Effect9 world tree，sound0静默。

## 限制

真实浏览器双端对局、Effect9/SE32实载像素、声音输出、不同画质、资源缺失、复活/再战、Leave/scene清理和HD仍未实测。本文件不把静态事件路径当作实际绘声或持久验收。
