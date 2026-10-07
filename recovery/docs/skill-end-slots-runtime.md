# 结束槽运行时

限制陷阱与群体闹钟的限制状态自然恢复（AD）、燃烧弹4005自然完成（AE）各自按采用合同单次通知第二槽。效果根与原WAV沿现发布目录、`MsgRoomEvent.playSkillEffect`与共享`BattleSkillEffects`/`SkillEffectNotifications`消费者使用，`MsgRoomEvent`无新增字段。

## 限制陷阱与群体闹钟（AD）

- 取得：item3003/3004/3005沿正常商城购买，item3007群体闹钟沿Breach与结算奖励取得。
- 放置与首槽：`placeGroundTrap`在PLAYING、存活status2与真实库存门禁后消耗实例、建立`GroundTrapSnapshot`，并沿现`trapTriggered`事件发首槽`playSkillEffect`（effectIndex0、duration0、真实numeric roleId）。
- 状态与贡献：`advanceGroundTraps`对每个玩家调用`expireTrapRestraint`/`expireTrapTurnRestraint`/`expireTrapFireRestraint`。受益者存活HP>0／status2且到达期限时恢复该状态的一份许可计数，随后删除状态。
- 第二槽：在原`trapRestraintEnded`事件附`playSkillEffect`，取真实`state.skillId`（3003/3004/3005→4001/4002/4003；3007→4024/4025/4026）、effectIndex1、duration0、真实numeric roleId与xBits/zBits0，XYZ为当前受益者位置。每个实际恢复的lane各通知一次；因expiry已删除状态，重复推进不重播。
- 不播第二槽：注射提前解除、死亡reset、显式clear、finish/round/loading、Leave只沿原clear/reset路径恢复或删除贡献，不发第二槽。
- 保持：首槽、五秒限制、贡献count回补与接触数值不变。

## 燃烧弹4005（AE）

- 建立与周期：正常购买item2007并命中后，`startAmmoBurn`建立九秒燃烧，`advanceAmmoBurn`在3/6/9秒推进三个70伤害周期。
- 自然完成：仅本次三个真实周期全部结算完成、同一burn仍有效、owner仍存在且目标仍存活时，`advanceAmmoBurn`先清本burn，并通过可选`onNaturalEnd(burn:AmmoBurnState)`回调只在该真实自然完成路径通知调用方。
- 事件：World在当前tick的`advanceAmmoBurn`调用点传入回调，在最终room仍PLAYING、目标alive／HP>0／status2门禁后push单次`ammoBurnEnded`，沿用原`MsgRoomEvent`与现generic消费者。playerId为原`burn.ownerId`，targetId与XYZ为受益target及其位置，skillId为`burn.skillId`（4005），`playSkillEffect.effectIndex`1／duration0／真实numeric roleId，`value=burn.startedAt`用现数值field指明结束的真实实例。
- 表现：4005第二槽为Effect7（根007）／SE30／tag0／method0。Web在`battle.ts`收到`ammoBurnEnded`后，仅在当前room仍PLAYING、room/round与结束实例一致且context有效时调用`AmmoBurnPresentation.end(targetId,value,context)`停止匹配`startedAt`旧实例的014／SE03，并沿同一条`playSkillEffect`进入`BattleSkillEffects`generic消费者播放007／SE30；FINISHED或无效当前context的`ammoBurnEnded`不送generic，旧首槽014/SE03由既有快照/生命周期清理。每frame仍拿旧snapshot的当前burn不得重启已通知结束的`startedAt`，新实例允许，context/clear擦除。结束标记不以单帧缺席判定释放：仅在权威snapshot确认受益角色移除／死亡／burn消失或出现新`startedAt`后释放；仍携带同一`ended.startedAt`的stale snapshot保留标记继续拦截重启，首槽view尚未创建时同样保留标记。
- 不播第二槽：注射、显式clear、死亡、owner离房、回调清掉或替换burn只走原清理路径；FINISHED或当前room/round与结束实例不一致、context无效的`ammoBurnEnded`不送generic，旧首槽014/SE03由既有快照/生命周期清理，finish／round／Leave等其他既有事件路径保持。
- 保持：三跳伤害、非刷新／非叠加政策及原014有限证据不变。

## 来源边界与未实测

限制自然恢复时点与燃烧自然完成时点为项目采用；原第二槽触发producer与时机仍未恢复，也不声称已恢复。当前交付仅为源码接线，本批已完成一次集中静态走查，未运行测试、浏览器、构建、类型检查、原生取证或音频播放。普通对局、双端绘声、清理、高清与持久实测仍未取得，tasklist对应父项与其具名子项保持未勾。
