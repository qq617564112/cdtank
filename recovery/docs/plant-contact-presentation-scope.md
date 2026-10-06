# 地图2 Plant 普通接触表现

M3-08/M2-03的新消费者范围：普通已许可运动与原Plant OBB接触，首次隐藏同一源物件；重复接触不重播，移动继续，换局恢复与Leave释放由主线及地图owner接线。Breach不属于原运动控制器+1e8集合。

| 环节 | 当前状态 |
| --- | --- |
| 原来源 | role-static-contact-provider-source.json 的原分类与Plant三个接收器条件已收；44e081→45efb3→461dd9首次隐藏、重复及预隐藏不再调用端点。 |
| 原效果与声音 | 已执行样本+fc=0，只有hideBoundary，没有effect或sound；原+fc非空可启动slot34，可选资源与实际Plant+fc来源仍缺。 |
| 正式消费者 | 主线负责源身份/OBB/hidden状态及普通运动事务；地图负责同id原root隐藏、换局恢复和owner释放。正式接口已接入 `MatchSnapshot.scenePlants`，`Battle` 向 `ScenePreview.reconcilePlants(states, round)` 传递完整快照。 |
| 普通实战与双端呈现 | 新普通网络接触已记录 `role-static-contact-network-2026-10-05T16-27-09-674Z.json` 的有限PASS；主审 `plant02-contact-root-review.json` 有限接受双端root禁用、host绘制停止与Leave；原raw INCOMPLETE保留，独立前后像素和guest目标绘制未证。旧sway路线两次未绘制保持原gap。 |

当前有依据的基础隐藏不添加Breach c9、GA13、普通shotItemResult或替代烟尘。原环境BG四voice继续由MapEnvironmentSound持有，不能计作Plant接触声音。实际记录须关联正式对象id及隐藏事务，按同对象检查root启用、真实绘制停止、重复无新效果/声音请求和Leave owner释放。可选原效果来源未收，不称所有Plant在原程序中必然静默。

准备环境观察器 tests/observers/map02-environment-prepared-browser.mjs 由地图owner持有，双页Login后Create/Join前安装，保持同observer跨正常Leave/reentry。加载返回后的playing监听可能错过已发生事件，以paused状态和原声音身份准确记录；不主动reload、replay或修改相机/clock。新隐藏验收使用同root独立实际绘制累计计数及lastFrame，记录hidden快照处理前后enabled，再观察自然帧中的计数停止；摆动samples上限2只证明已采样的摆动，不证明隐藏后停止绘制。

正式对象使用 `id: PLANT:<sourceId>`、`sourcePlacementId`、`sourceModel`、`enabled`、`hidden`。Map02 modes1/2/3登记原29株obj05413；首次接触仅发布 `scenePlantHidden`，其 `targetId` 与 `scenePlant.placementId` 指向同一源物件。显示端保存原root及sourceEnabled，完整快照替换隐藏ledger；快照可先于load，后注册root仍按该状态设置enabled，新轮按新快照恢复，clear/Leave释放ledger和owner。

`scene-plant-contact.json/.log` 已收模块资格：动态角色重叠先拒绝，首次静态type100接触隐藏且允许运动，重复静默，phase和round初始化边界。该结果不替代普通网络输入与双端浏览器呈现验收。

新网络实战 raw 为 `role-static-contact-network-2026-10-05T16-27-09-674Z.json`：普通运动在tick111使 `PLANT:327` 从hiddenfalse变true，具名事件一次，124个公共快照key一致；随后0.4模拟秒继续移动51.9975403264单位，HP与分数不变，fire输入0，四个正常Leave均成功。两身份复用真实购入tank3/pet2 checkpoint，两新空账户按既有tank1普通入场资格参与；无新购买、库存写或活跃状态注入。该证据仅接受接触、网络状态和Leave响应，不证明root绘制停止、可辨画面或音频静默。

固定地图2整图范围见 map02-restoration-status.md。原placement身份适配、enabled进入集合及服务端接触许可按主线注明的重建边界记录；本合同不提供新的原权威规则或实际PASS。

## 普通浏览器实际范围

`plant02-contact-root-review.json` 状态为 `PASS_FINITE_MAP02_PLANT327_CONTACT_ROOT_HIDE_HOST_DRAW_STOP_LEAVE_SCOPE`，工程关联 `plant-contact-tank-owned-engineering.json`，网络关联 `role-static-contact-root-review.json`。`browser-plant02-contact-2026-10-05T16-30-17-255Z.json` 保留INCOMPLETE。双端同 `PLANT:327` 接触事件各一次，rootStates记录hiddenfalse/roottrue→hiddentrue/rootfalse，原29owner保持。host隐藏时drawCount6/lastFrame321，随后1500ms读数仍6/321；guest计数0，接受状态禁用，未证明目标可见后停止。两张完整1280画布只采于接触后，不能证明327独立前后像素。

两项失败来自观察器snapshot条件使用顶层mapId；正式 `MsgRoomSnapshot` 的地图身份位于 `roomInfo.mapId`，故snapshots数组为空。原结果不改为PASS；已有rootStates和普通网络证据分别保持各自范围。该记录问题不证明生产隐藏失败。

双正常Leave后broken/Plant mesh/effectinstance/scenevoice/battlevoice均0，Plant roots/snapshots均0、roundnull。四原BG双端各looptrue、playingtrue、pausedfalse；Leave后原audio全pausedtrue，voice0/masterfalse/mapfalse，Water与Plant owner也均释放。环境声不计作Plant接触声；当前 `BattleSound.event` 仅处理fire/destroy，隐藏事件直接返回。原可选Plant+fc效果来源及完整父项仍开放。

## 同次环境绘制证据

该raw的environment记录双端各13株obj05413的两次不同position自然draw；host327为frame316/317，guest没有327目标draw。双端water/waves各96顶点，host frames281/282/283、guest226/227/228实际onBeforeRender中，水纹vOffset分别为0.021539999/0.045634999/0.058705002与0.019670000/0.030789999/0.107025005，waves原纹理各CAUST01→CAUST02→CAUST03。这证明此次普通对局的双端环境动画绘制和参数推进，不证明两张接触后whole中水面时序可辨或全部Plant独立像素。旧水路线FAIL保持，已记录的动画绘制不另跑。
