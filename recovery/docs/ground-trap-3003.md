# 捕兽夹3003正式业务

普通Shop购买3003，Home配置实际实例到快捷槽2–4，正式PLAYING输入沿原快捷槽与trapPermission门禁产生placeTrap请求。服务端确认持久库存CAS成功后，同时扣拥有量与本局量各1，在角色确认世界位置创建单次地面对象。失败或保存异常不扣量、不建对象。itemUsed确认驱动库存重新读取，trapPlaced确认驱动原3003施放表现。

地面对象来自原03003.POL与同目录纹理。模型3003、yaw0、scale1及角色当前位置附着属于明示重建；普通快照presence负责模型创建与释放，期限由服务端判断，客户端不另算时间。原Func12的t30/x30/y4001/z3003分别解释为30服务器秒、30世界单位接触半径、作用技能4001与模型3003，参数解释并非已取得的原服务端实现。

正常敌方进入半径后，单次对象消失；团队模式1–3排除同队，其他模式排除本人。目标存活、status2、当前flag9计数大于0且没有此束缚时，原uint8计数减少1，发布原数组通知33。期限取4001 Func3 t5解释为5服务器秒；到期当前计数增加1，保留期间其他计数生产者的变化。不叠加、不刷新；count1→0阻止直行与组合转向，count2→1仍许可。原地车体转向由flag10、开火由flag11控制，瞄准独立，沿原movement消费者执行，不增加状态强制冻结。

死亡丢弃束缚，由原生命周期初始化许可；复活、结算、再战清掉本轮对象与束缚。正常Leave删除自己地面对象，离房角色状态释放；消费不退款。触发事件4001仅在正HP且flag6为0时附原effectIndex0通知。3003施放010与地面03003模型分别消费；4001首效果112由现角色效果桥接。

## 接口与归属

root owns `battle/items/ground-traps.ts`、World、RoleCombatState精确flag9 writer、Shop范围、RoomState与快照、shared协议生成和Battle呈现hook。数值线owns `trap-restraint.ts` 和首次真实购买网络验收。FX owns `Trap3003Visual` 与 `GroundTrapsPresentation`。

match.groundTraps包含id/ownerId/team/itemTableId3003/modelId3003/x/y/z/expiresAt。players.trapRestraint包含skillId4001/expiresAt/movePermissionCount。事件分别为trapPlaced、trapTriggered和trapRestraintEnded；附属itemUsed只在确认消费后发送。原客户端flag9下降observer来源与缺少原producer的边界见trap-restraint-contract.md。

## 验收

`ground-traps-authority-rules.json/log` 模块已通过持久CAS拒绝/异常不变、一次确认扣量、本人/同队排除、单敌方接触、通知33、flag10/11保留、deadline前后恢复及未触发对象到期清理。`trap3003-production-server-build.log` 与 `trap3003-production-web-types.log` 必要工程检查exit0，协议已生成。原数值13条件与FX模型/presence/晚load清理模块证据复用。

真实取得与联机有限范围已通过：`tank-purchased-trap-restraint-player-accepted.json` 引用首真实业务原始记录及原生持久库只读证明，确认购买/放置/敌方进入、157共同tick/7完整事件、五服务器秒计数恢复和双Leave。原速度130，恢复129.986；束缚直行/倒退/组合位移0，独立body/turret转角.1702每.25模拟秒，HP700保持。数据库拥有剩余1，hotkey槽1实例3。正式模型绘制/像素验收独立进行。CPU新增策略、注射解除、全部陷阱、原Func12执行器与完整父项保持未完成。
