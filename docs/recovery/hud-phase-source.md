# 原 HUD 阶段显隐入口（M5-04-HUD-PHASE）

通用窗口显示入口 `0x4d6216` 完整原执行 PASS8；原阶段显示规则仍缺上游入口，当前项目规则已由用户确认采用。`hud-phase-native.json`保存八组原执行记录，`hud-phase-source-locations.json`保存字符串、导入与准确指令范围。正式HUD已接当前阶段策略，完整页面验收仍待完成。

## 原窗口与共享入口

HUD初始化 `0x4c776d..0x4c77a9` 从 `0x5d0ecc` 的 `data\ui\layouts\game_main.xml` 载入根，并保存至controller+8；RoomPanel初始化 `0x50a163..0x50a19f` 从 `0x5d65b8` 的 `data\ui\layouts\room_main.xml` 同样保存根至+8。`GameMain/picBattleInfoPanel`（`0x5d0dec`）在 `0x4c7b0b` 缓存至+0x628，`GameMain/edtBattleInfo`（`0x5d0dd4`）在 `0x4c7b45` 缓存至+0x62c。

`0x4d6216`接收一个show布尔参数，检查root+8。父sheet `0x893128` 存在时调用原isChild：show且未挂接才addChildWindow，hide且已挂接才removeChildWindow；已满足状态不重复挂接。没有父sheet时show通过System::setGUISheet设置根。随后执行虚方法+0x2c或+0x30，并将布尔值存至controller+0xc；root为空仍写标记，不执行窗口或生命周期调用。

八组覆盖父sheet存在/不存在、已挂接/未挂接、show/hide与空root。原函数全部指令执行至正常返回，stack清理和+c值均核对。CEGUI isChild/add/remove、System/setGUISheet和虚生命周期回调为明确provider；没有执行完整场景、GPU或原窗口消息循环。

HUD调用点 `0x4d23f7` 与RoomPanel调用点 `0x50f5c5` 直接把各自函数参数转交共享入口。两处没有WAITING/PLAYING/FINISHED判定。取得共享窗口挂接规则不能替代取得阶段生产入口。

## 原信息面板

当前顶中空黄色区域为原 `game_main.xml` 的picBattleInfoPanel，原矩形309,0,263,93与资产 `ui/regions/77/2.png`；edtBattleInfo为空。现场记录见 `waiting-room-presentation-hud-observation.json`。

已定位的panel消费者使用alpha：`0x4d0412..0x4d0426`在日志更新后清+0x95c计时并设alpha1；`0x4cae80..0x4caeb3`读取阈值 `0x5cfb08` 的8秒，累计frame dt后设 `0x5c4794` 的float32(0.2)；`0x4ccac7` hover设alpha1，`0x4ccade`在计时达阈值后恢复0.2。这些片段未作为完整业务原执行，也没有提供原WAITING显隐判定。

## 原生产来源边界

缺失的是scene/phase dispatcher到GameMain与RoomPanel的show布尔生产调用链：必须证明等待、开局、终局与再战分别如何挂接两根，以及相应生命周期回调是否覆盖子控件状态。该原入口没有这些条件；项目现采用用户确认的WAITING/LOADING隐藏、FINISHED保留政策。该缺口取证停止，不将网页现状当作原规则。

可独立交付的已有HUD玩家功能是权威生命与头像受击/死亡/复活、原装填反馈的正式普通操作闭环；现有源依据见 `ui-runtime.md`、`reload-hud-source-sol.md`。另一有限候选是战斗消息面板的原8秒alpha与hover反馈，以上地址已经定位；完整原消费者执行和实际玩家消息接线仍需单独业务片授权与验收。本片没有新增字体、GPU或全HUD状态范围。

## 当前接入

本轮当前实现：正式快照入口和战斗帧更新HUD阶段，WAITING/LOADING隐藏、PLAYING显示、FINISHED保留终值。原Fight的显示/隐藏消费者直接读到1秒阈值，见 battle-ui-client-audit.md；模式介绍2秒及上述阶段策略已由用户确认采用，完整原scene/phase生产链仍保留取证边界。
