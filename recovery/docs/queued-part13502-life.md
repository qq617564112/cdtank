# 天堂之光自然生命周期验收入口

M4-09/M4-10。首入场双端实际可见、静默与离房已由`queued-part13502-player-accepted.json`接受。本片只补13502自然死亡停止及复活重新可见，沿原32/2755/2828资源与既有队列资格，不改变生产。

专属`tests/browser-queued-part13502-life.mjs`复用真实tank3/pet2购入checkpoint，正常购买17032并装配，双普通React进入mode4/map7。计划由guest普通方向键瞄准、Space射击使host自然死亡，释放输入后等自然复活；观察host效果实例归属、死亡无原32、复活新handle及完整双画布，再正常Leave。初次入场不作为第二次新交付。

首raw `browser-queued-part13502-life-2026-10-05T02-10-13-095Z.json`为FAIL：资源门槛前host显示连接已断开且world为空，guest留下单人WAITING，mapLoaded=false、renderedPlayers=0。只读终端补证`queued-part13502-life-first-live-gap.json`。未到Ready/射击/死亡，不能证明生命周期。错误轨迹仅favicon404与DOM提示，没有确定资源或断线原因。

首raw缺失入口为Battle.enter→ScenePreview.load→MapEnvironmentSound.load→MapSceneEffects.load→mapLoaded→BattlePlayers.resourcesReady，其player loadingError及服务连接关闭原因未采。专属runner补上述四load的原Promise阶段、Battle实例真实resourcesReady/loadingError、终端world/status和完整服务日志，不改变返回、快照或状态。主线持有正式断线原因诊断，并协调唯一带此观察的定向运行。

定向诊断实际`browser-queued-part13502-life-2026-10-05T02-15-24-000Z.json`正常入场并完成普通自然战斗，完整服务日志同前缀`-server.log`。四加载入口均resolved，无观察到的disconnect；原期限/心跳未改。该成功不证明首FAIL或旧三人入口的原因。

guest普通炮塔键瞄准和Space射击，16次自然命中使host700→0；释放射击后自然复活700。两端分别首次观察死亡tick631/629、复活tick692/690，不能将浏览器观察tick当精确服务deadline。共同tick0/46/48/650完整players一致。死亡期每端16个实际渲染帧原2755实例均为空；复活后旧handle6分别更换为52/58，归属仍player-P1，2828两端实际draw。声音观察各有初次和复活两个Sound0请求，普通16次命中SE30声音仍存在，不把全场称为静默。

完整640×360死亡画布两端可见正常09残骸与末次普通命中爆火；本机复活canvas1-8可见浅黄白星粒子。另一端复活canvas2-6/7/8未见可辨星粒子，双方复活坐标恰同为(361.99,424.73)、朝向-1.7453且模型重叠；只收其新实例实际绘制，不收远端复活像素。正常双Leave后effects/meshes/skill、tree与Battle声音均0，world为空，专属process/temp清理通过。索引`queued-part13502-life-player-accepted.json`待主线亲审。

原死亡/复活授权和快照时序为现重建政策。远端复活星粒子、普通多项轮换、战车3四组件09尾帧/01时钟及原分辨率保持开放。本片不替代旧CPU三人加载失败原因或完整动作验收，不关闭父项。
