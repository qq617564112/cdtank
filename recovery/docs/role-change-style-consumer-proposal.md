# FUNC-08 角色伪装消费者

物件10/11的两种伪装沿原4173/4174显示字段接入生产。style1使用obj05428南瓜、style2使用obj05422木桶；服务端状态提供确认期限与创建位置，网页以`PlayerSnapshot.roleDisguise`为主要状态来源。普通请求、成功消费和采用的业务规则见`role-disguise-runtime.md`及`client-communication-business-rules.md`，源接收证据见`role-change-style-receiver-source.md`。

## 原显示合同

原4173 `UMsgChangeStyle` 为style8、roleId32：style1加载obj05428南瓜，style2加载obj05422木桶。接收角色和actor缺失时不操作；存在时隐藏战车actor，按角色当前XYZ创建替身世界对象，并保存生成的对象名称用于删除。4174输入roleId32，恢复战车并删除该角色记录的替身对象。原setter与两种tankrender门禁已执行，九路由与四绘制门禁PASS；原链没有本机、同队、敌对显示区别，也不清除其它角色绘声。

源模型已有174/108展开顶点与原128纹理资格，可复用既有场景资源，不重新转换。源码只确认创建时复制角色XYZ，不能提前决定替身跟随角色。原链不能借作I09的隐身过滤或透明度来源。

## 当前正式状态与通知

`PlayerSnapshot.roleDisguise`包含skillId10/11、style1/2、startedAt/expiresAt和施放XYZ。`MsgRoomEvent.roleStyleChanged`对应原角色/style显示字段，公共事件XYZ来自权威施放位置；`roleStyleRestored`对应原恢复身份。共享schema手工附加version93、property41及event20/21，未执行生成器；不宣称原codec注册或uint32 objectId生产已恢复。

`BattleRoleDisguises`按角色持有替身，键为skillId/style/startedAt/expiresAt/x/y/z。同epoch的快照与通知保留一个替身；快照覆盖断线、晚加入和模型晚加载。替身固定在确认施放XYZ，不跟随角色后续位姿；原后续跟随没有得到证明。

`BattlePlayers`以快照为准呈现双方可见的替身并隐藏战车root；角色位姿、动画、相机、插值和碰撞/命中/伤害/HUD路径不变。非PLAYING、死亡、复活前、新局、离房、reselect和清理都会释放替身并恢复战车。`changeRoleStyle(roleId,style)`/`restoreRoleStyle(roleId)`只做快照身份核对，不合成状态或重放通知。

## 待集成与验收

另一实现者补齐`Battle`对`roleStyleChanged`/`roleStyleRestored`的显式转发，以及延迟接受开火后再激活伪装时以真实fire结果恢复当前伪装的合同；本次不把这两项写成已完成。原Func8到4173/4174的server producer、T期限writer及原flag12与显示恢复关系仍未恢复。

依据`role-change-style-receiver-source.md`及`role-change-style-receiver-native.json`的9组接收路由/4组draw门禁；codec组合探针未通过，`role-change-style-wire-native-incomplete.json`不作为来源PASS。`recovery/prepared/role-change-style-presentation.ts`保留原回调式消费者来源合同，raw参数2/0未赋予新语义；生产网页按当前状态及资源所有权实现，不把准备模块当作普通玩家验收。当前仅登记实现状态，普通施放/拒绝、双端实际绘制与恢复、自然到期/开火/死亡/再战、高清及库存实际重启仍待实测；一次集中gpt-5.6走查待root集成后执行，FUNC-08及M4-10保持未完成。
