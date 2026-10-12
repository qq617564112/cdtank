# 正常入口效果槽运行时

限制陷阱与群体闹钟、燃烧弹4005第二槽，以及宠物指挥10541两槽已接生产通知。效果根和原WAV沿现发布目录、`MsgRoomEvent.playSkillEffect`与共享消费者使用，协议无新增。触发时点采用以下项目规则。

## 限制陷阱与群体闹钟

| 作用 | 正常物件与技能 | 自然恢复第二槽 |
| --- | --- | --- |
| 直行限制 | item3003→4001；item3007→4024 | Effect17／SE16／tag0／method0 |
| 车体转向限制 | item3004→4002；item3007→4025 | Effect16／SE15／tag0／method0 |
| 开火限制 | item3005→4003；item3007→4026 | Effect16／SE15／tag0／method0 |

3003/3004/3005沿正常商城购买，3007沿Breach及结算奖励取得。`placeGroundTrap`在PLAYING、存活status2与真实库存门禁后消耗实例、建立`GroundTrapSnapshot`并沿现`trapTriggered`发首槽。`advanceGroundTraps`调用现三条expire函数：对存活HP>0／status2且到达期限的受益者恢复本状态的一份许可贡献，先删除状态，再在原`trapRestraintEnded`事件附`playSkillEffect`，取真实`state.skillId`、effectIndex1、duration0、真实numeric roleId与xBits/zBits0，XYZ为当前受益者。每个实际成功的lane各通知一次；expiry状态删除因此只一次，重复推进不重播。

首槽、五秒限制、许可计数与接触数值保持。注射早清、死亡／复活、finish、round/loading、Leave仅沿原clear/reset恢复或删除状态；这些路径不发第二槽。自然恢复不增加HP或flag6门禁。Effect016/017根及SE15/SE16原WAV已发布，通知直接进入现共享槽，不新增计时器、停止消息或效果队列。

## 燃烧弹4005

正常购买item2007并命中后，`startAmmoBurn`建立现九秒燃烧，`advanceAmmoBurn`仍在3/6/9秒推进三个70伤害周期。仅本次三个真实周期全部结算完成、同一burn仍有效、owner仍存在且目标仍存活时，`advanceAmmoBurn`先清本burn，并通过可选`onNaturalEnd(burn:AmmoBurnState)`回调只在该真实自然完成路径通知调用方。

World在当前tick的`advanceAmmoBurn`调用点传入回调，在最终room仍PLAYING、目标alive／HP>0／status2的门禁后push单次`ammoBurnEnded`。事件沿用原`MsgRoomEvent`与现generic消费者，无新schema：playerId为原`burn.ownerId`，targetId与XYZ为受益target及其位置，skillId为`burn.skillId`（4005），`playSkillEffect.effectIndex`1／duration0／真实numeric roleId，`value=burn.startedAt`用现数值field指明结束的是哪个真实实例。skill4005第二槽为Effect7（根007）／SE30／tag0／method0，沿现共享消费者单次播放。

Web在`battle.ts`收到`ammoBurnEnded`后，仅在当前room仍PLAYING、room/round与结束实例一致且context有效时调用`AmmoBurnPresentation.end(targetId,value,context)`停止匹配`startedAt`旧实例的014／SE03，并沿同一条`playSkillEffect`进入`BattleSkillEffects`generic消费者播007／SE30；FINISHED或无效当前context的`ammoBurnEnded`不送generic，旧首槽014/SE03由既有快照/生命周期清理。每frame仍拿旧snapshot的当前burn不得重启已通知结束的`startedAt`，新实例允许，context/clear擦除。结束标记不以单帧缺席释放：仅在权威snapshot确认受益角色移除／死亡／burn消失或出现新`startedAt`后释放；仍携带同一`ended.startedAt`的stale snapshot保留标记继续拦截重启，首槽view尚未创建时同样保留。三跳伤害、非刷新／非叠加政策及原014有限证据不变。

注射、显式clear、死亡、owner离房、回调清掉或替换burn只走原清理路径；FINISHED、无效context或room/round不匹配的`ammoBurnEnded`不送generic，finish／round／Leave等其他既有事件路径保持。

## 宠物指挥10541

宠物5和105的开放学习槽均选择base10541／rankCap1，实际技能为10541。首槽Effect102／SE34／tag0／method3、第二槽Effect104／SE36／tag0／method3沿现发布根与原WAV消费，保`runtime.retainedEffect=false`／`queuedEffect=false`及duration0单次。

World在现`simulateRoom`每个模拟tick调用`PetBattleSkills.reconcileCommandEffects(events)`，不新增tick、定时器、轮询、队列或transport。受益角色active、alive、status2且attributesReady时，读取本人真实已选或复制的10541被动指挥来源；模式1–3再读取同队alive／status2／attributesReady的指挥来源。模式4/5只有本人来源。本人来源保持原属性作用范围（全五模式本人），不新增队伍传播；非本人同队传播只走模式1–3现`refreshTeamSkills`路径。多个有效来源合并为当前有／无指挥资格，数值传播、skillId去重及重算保持现合同。

首次无→有时向该受益者发一次首槽。有效资格持续存在时，重复tick、刷新、换caster或多个同id来源不重播；呈现状态只保留先前skillId与casterId字符串并更新当前实际caster，不持额外player引用。最后一个来源撤回且受益recipient仍live时，先清呈现状态，再向该角色单次发第二槽。copy替换、来源死亡／Leave在下一active tick反映，仅对仍存活合格recipient撤回；recipient自己的死亡／Leave、finish／round／换局只clear呈现状态、不播结束。新生命或新局沿真实资格重新建立首槽。

通知复用`petSkillTriggered`与`playSkillEffect`：playerId为实际来源caster，targetId及numeric roleId为受益者，skillId10541，effectIndex为0或1，duration0，value0，XYZ为受益位置，xBits/zBits0。本人来源优先，队友来源按房间顺序选择；来源替换不新增表现。部件队列和原attributes／heal／copy／lastStand首槽通知保持，指挥不增加timer、队列或保留消息。当前pet105映射仍用10541，原11041与10761的rank0槽不新增普通来源。

## 限制

集中清单A–AF的生产接线／资源发布已完成。上述自然恢复、自然燃烧完成与指挥获得／撤回时点为项目采用；原第二槽时机、指挥受益者分配和完整原producer仍缺来源。当前交付为源码接线，本批已完成一次集中静态走查，也未运行测试、浏览器、构建、类型检查、原生取证或音频播放。普通对局／双端绘声／清理、高清与持久实测按tasklist正文继续开放；既有数值与首槽证据只保留原范围，完整父项保持未勾。
