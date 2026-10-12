# 战车网页动画的原引擎时间输入

M3-04 / M2-03：`TankView` 正常 `onBeforeRender` 动画入口现在先应用原 `gbGfxManager::GetDeltaTime` 合同，再将结果存为 float32，传给既有 `EffectActorActionClock`。

原 getter `0x10028030` 从已缩放的引擎 f64 delta 读取时间：严格小于0.5秒原值返回，其余返回 f64 0.1秒。共享 `effectModelEngineDelta` 原本已用于特效模型 backend；战车入口过去直接传浏览器帧差，后台或长帧可能把完整动作推进越过来源允许的步长。正常战车入口现在使用 `Math.fround(effectModelEngineDelta(frameMilliseconds / 1000))`，对应场景更新 `0x45004a` 先将 getter 输出存为 f32 `scene+0x14` 再调用 actor virtual+0xc 的顺序。比较发生在存 f32 之前：例如 f64 0.499999999可成为 f32 0.5；精确 f64 0.5则返回 f32 0.1。

`advanceAnimations(deltaSeconds)` 仍是明确接收已准备时间的入口，不再次读取引擎或截断。动作速率、时间取整、事件与结束边界由既有原动作时钟负责。浏览器帧差是重建的时钟供给，尚未代替原 Windows 时钟、全局 timeScale、所有客户端 stage/暂停门禁；网页房间 WAITING/PLAYING 也不能直接当作原 scene状态。此改动不接通位置插值、目标运动门禁或履带A/B切换，不改变权威战斗时限、技能通知计数与道具消费。

既有 getter 原执行证据见 `effect-model-rendering.md`、`effect-model-source-state-native.json`，完整场景时钟来源及边界见 `role-actor-global-clock-sol.md`。实际生产正常帧入口、长帧动作/事件与释放验证见 `tank-actor-clock-browser.md`；该验证重放时间输入，不能代替自然联机对局或全内容高清性能验收。
