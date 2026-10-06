# 0021普通破坏后的碰撞与清理

M3-08-BREACH21-COLLISION-B由实际普通网页输入验收当前重建碰撞合同，不关闭原NAV收集器或地图格更新内核。既有完整placement动态OBB/NAV覆盖在物件破损淡出期间保留，严格超过2秒释放；每个房间独立，普通再战重新覆盖。源模型、淡出、GA13和四型号来源复用此前有效证据。

## 正式清理修复

最后一个真人离开时，rooms/departure会移除整个房间。此前没有释放动态覆盖，保留该field的只读检查仍见73个覆盖。现删除前调用battle/breach-collision的resetBreachCollision，移除动态OBB并恢复源NAV；不改变尚有真人的房间或源BOX/NAV字节。

`npx tsx tests/breach21-room-departure.cts`普通World建房、3CPU、Ready、最后真人Leave，保留field仅用于只读检查，所有73placement的NAV与BOX查询恢复到原无动态覆盖的独立field；结果breach21-room-departure.json/log PASS。这是规则/World验收，实际双网页另列。

## 验收进程观察器

`tests/observers/breach-runtime.ts`通过专用Node `--import`和CDTANK_BREACH21_TRACE启用，正式入口不引用。只调用原World.step/leave、setDynamicBox，读取其结果后记录状态，不能写入位置、伤害、输入、时间或胜负。

collisionPhase逐原placement记录INTACT/FADING/RELEASED及NAV、中心OBB和revision。actorEnteredClearedFootprint只记录真实存活CPU或托管中心已进入释放的原OBB水平footprint；projectileCrossedClearedFootprint必须同一实际bullet在前后两个step存活且其已走过的轨迹跨该源OBB，不能用预测ray查询代替真实穿越。ordinaryProjectileImpact来自真实权威事件。roomLeaveCleanup记录最终删除的原field动态覆盖数。

类型检查、服务端发行与运行依赖边界已通过，日志breach21-wrap-server-types.log、breach21-wrap-server-build.log、breach21-wrap-boundaries.log。正式双网页分段验收breach21-collision-b-actual.json/log PASS：同SCN62原c9与GA13、真实CPU中心进入清理footprint、实弹跨原OBB；自然再战/修复后离房引用browser-breach21-collision-b-2026-10-03T21-56-07-028Z.json完整PASS。源NAV/完整bounds保留策略仍重建；旧观察器墙钟不作为精确源时钟证据。
