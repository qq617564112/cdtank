# 0021破坏后的实际通行与弹丸穿越

普通0021双网页战斗中，同一原物件62（SCN:62、obj05468）实际切换六节点c9.CVD，GA13在原物件位置播放并结束。完整及渐隐阶段保留原OBB与NAV占用，释放后普通CPU中心进入原水平footprint，存活实弹穿过同一原OBB。普通自然再战恢复73个目标及占用，离房清空浏览器资源和房间动态覆盖。

## 原表现与正式消费者

原05468加载、c9选择、GA13和渐隐来源沿用[原05468表现](scene-breach-0021-05468.md)，其他三型号和0021环境声音沿用其既有证据。正式`ScenePreview`按原placement ID消费真实objectiveDestroyed及destroyedAt，`SceneBreachVisual`提交原c9几何、纹理和轨道。本片选定62原matrix中心为(386.4195556640625,22.452104568481445,437.20849609375)，bounds为(94.64885711669922,45.18581771850586,94.64886474609375)；GA13仍使用原几何origin的y=0。

每房`syncBreachCollision`保持完整原placement OBB及12单位NAV覆盖，权威elapsed严格大于2秒时释放，轮次恢复，离房删除前清理。原.box和NAV字段保持不变。该覆盖策略及原NAV格内核仍为重建实现；原Breach清旧覆盖后apply1的来源边界沿用[原破坏模型与导航边界](scene-breach-0021.md)，不把原模型切换直接解释为立即通行。

## 同一个普通目标的实际闭环

`breach21-collision-b-actual.json/.log`由`tests/breach21-collision-b-actual.py`复核实际记录，为PASS。双网页普通tank1账户、两个CPU、mode5/0021、Ready及AI托管产生自然移动和射击；客端另使用普通A/D/W与方向键跟随观察。没有位置、HP、胜负、通知或相机写入，浏览器使用默认音频策略，软件framebuffer为320×180。

同SCN:62在`browser-breach21-collision-b-2026-10-03T21-50-28-291Z.json`的双端捕获帧915/842实际提交六个原c9节点，alpha分别0.5438000559806824/0.8590999841690063。完整POL关闭，碎片随后隐藏。两端GA13实际playing/ended，duration均0.701814秒，loop=false且位置等于原placement.position。`-natural-1.png`主端近景原黑碎片与`-natural-2.png`客端左侧中景原黑碎片可辨；同时出现的黄色射击效果属于独立角色射击消费者。

只读服务器观察器`tests/observers/breach21-runtime.ts`仅在专用验证进程记录正式World.step、实际弹丸及房间覆盖，不改变状态、时间或输入。所选物件记录如下：

| 阶段 | tick | HP | 动态覆盖 | 原NAV格valid | navigationRevision | 原OBB命中 |
| --- | ---: | ---: | --- | --- | ---: | --- |
| INTACT | 1 | 200 | 保留 | false | 73 | SCN:62 |
| FADING | 1236 | 0 | 保留 | false | 115 | SCN:62 |
| RELEASED | 1276 | 0 | 释放 | true | 117 | 无SCN:62 |

同格原fields始终5。自然CPU2命中事件发生在tick1172，毁坏发生在tick1236。释放后的实际弹丸B261由P2发射，tick1355从(322.51366459102553,20.000013163771655,389.29103365377034)前进至(339.16215666551835,20.000013163771655,396.13411129804336)，同一bullet在World.step前后存活并穿入原OBB，交点fraction为0.9359083360203979。该证据来自实际飞行轨迹，没有构造查询射线。

tick1601，存活CPU2中心实际到达(341.0479706723706,0.000020507284716586582,467.59716110321153)，x/z均位于原水平footprint内。释放先于弹丸穿越和角色进入；浏览器两端目标hp/destroyedAt与服务器同一毁坏一致。

## 普通再战与离房

`browser-breach21-collision-b-2026-10-03T21-56-07-028Z.json`为剩余轮次及清理专项PASS，通过`--rematch-leave-only`执行。73目标自然全部摧毁后，双真人普通Rematch进入round2；原完整模型恢复，alpha1、fading=false、hidden=false、声音去重复位，旧c9网格停绘，73目标HP恢复。

服务器round2记录73个INTACT覆盖；SCN:62原格重新valid=false、原OBB命中恢复。双端普通离房后breakables、brokenMeshes、effect instances、scene voices及battle voices均0；最后真人离房删除房间，activeDynamicBoxes=0。专用3290/5320/9520、临时账户库及浏览器目录退出时清理。

## 限制

双端可见破坏来源的整体运行保持FAIL，专项复核仅接受其完整SCN:62实际记录；轮次恢复和清理使用独立普通专项PASS，不将前者改写为整场验收通过。该来源旧观察器的observedAt是读取墙钟，不能据此声称精确权威2秒边界；严格elapsed>2000来自正式World规则与既有breach21-world验证。

原NAV覆盖收集器、格内核、破损包围重算及服务器伤害规则仍未恢复。本片验证当前重建provider的实际通行闭环，不补造原版内核来源，也不扩大到其他地图、技能或全部飞行入口。

统一最终工程证据：breach21-wrap-metrics-final-web-build.log（Web类型/发行1m32s PASS）、breach21-wrap-final-boundaries.log（310正式模块PASS）；碰撞离房修复另见breach21-wrap-server-types.log/-server-build.log与breach21-room-departure.json/log。
