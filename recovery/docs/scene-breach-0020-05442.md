# 0020 obj05442原空根与破坏消费者

原obj05442 c9.CVD保留八个序列节点：index0为独立空根，index1..7为七个实际几何根，各25个原顶点帧。空根没有几何、材质或动画轨道，正式资源保留slot0与原parent编号并不绘制该节点；七个几何节点消费各自原轨道、顶点、材质及同目录纹理。原破坏分派选择GA41一次，重复destroy不再播放。

## 原执行依据

`scene-breach20-05442-empty-native.json/.log`执行gbengine.dll原gbGeomNode构造0x1000fe70、成员LoadCVDFromStream0x10011150及静态递归入口0x10011540。构造将+0x7c及+0xbc矩阵设identity，几何/轨道指针及+0x10c置0；读取实际c9 offset8的present0后0x10011189跳到0x10011330返回，无读取geometry body。递归入口仍于0x100115a3保存node指针，0x100115b0递增slot index，再读取原children0，合计消费5字节。分配器、基础命名节点构造、memcpy、gbVFile读取provider和stack cookie为供给边界；关键空节点构造、读取分支和槽位保留均执行原指令。原文件185592字节由严格CVD解析器完整消费，七个有绘制根均parent=None。

`scene-breach20-05442-native.json/.log`执行CDTank.exe原4610f1型号loader与44e081破坏分派，生成并使用`data\scnobj\obj05442\obj05442.pol`及同目录`c9.cvd`，按原GA41/selector1/物件origin派发并核重复静默。图形loader/device、字符串存储、分配器和导航更新为明确供给边界。

正式`export_effect_models.py`对原present0发布`parts:[]`并保留parent，`export_scene_breach20.py`发布05442八节点资源。现EffectModelRenderer自然为无动画节点使用identity并无parts不draw，无需新几何或轨道。ScenePreview按型号选择05442 c9/GA41，server资格为21个原放置，四个厚型号共60覆盖。

## 普通路线与验收

首件source279原geometry origin为(228.90701293945312,0,-1695.007080078125)，OBB中心(229.9073944091797,18.601215362548828,-1693.8658447265625)，bounds(35.076568603515625,37.23847198486328,33.387001037597656)。原旋转矩阵用于碰撞；声音/绘制使用geometry origin。

`breach20-05442-route.json/.log`通过普通World建房/CPU/Ready建立真实coverage，再只读原NAV与原角色footprint进行路线计划。共同spawn(-304.71,-1119.34)距目标约785；路线使用24单位转向净空，仅用于输入计划，实际原角色49×52 footprint不变。三个路点绕行至目标东北侧160。浏览器仅用普通W/A/D/S、方向键、Space跟随路点与只读world，不写位置、HP、时间、胜负或相机。双端draw验收按实际node1..7，不把空slot0计作geometry。

## 普通双端完整验收

`browser-breach20-05442-2026-10-03T23-21-05-452Z.json`及`browser-breach20-05442-run4.log`完整PASS。338条普通按键、实际位置/距离/路点阶段样本证明同SCN:279自然命中破坏，双方完整POL实际draw、七原c9节点1..7实际绘制及node1姿态变化、GA41非循环playing/ended(0.948435秒)、原origin位置和渐隐hidden。捕获自然frame627/531，alpha0.817550003528595/0.8489000201225281，双方自然PNG可辨原碎片，画布软件320×180。

INTACT tick1→FADING508→RELEASED548，authority elapsed2014ms，完整与渐隐期间原OBB/NAV阻挡，释放后原coverage解除。存活普通输入P1/P4分别tick562/574进入原旋转footprint；存活B76(ownerP1)在tick632前后持续存在并跨旧OBB。普通W由权威NAV阻挡到实际释放，不使用页面不存在的时钟字段；双方进入后按实际距离退至>=160并停移瞄准射击，玩家与弹丸通行独立成立。

同次运行按实际remaining148+15等待自然FINISHED，正常双Rematch round2恢复原POL/HP/alpha1/声音去重与覆盖，双Leave后breakables/brokenMeshes/effect instances/scene voices/battle voices均0，最后真人Leave删除房间及动态覆盖0。专用3294/5324/9524和临时目录清理，独立`breach20-05442-process-cleanup.json`核端口关闭、专属进程与temp0，非主JSON字段。root独立`breach20-05442-actual.json/.log`为PASS，并观察双自然截图。

## 已保存失败范围

首两次运行在(245,-1459)附近窄转角停住，目标279HP仍200，均提前终止；各自`run1-route-failure.json`/`run2-route-failure.json`为部分只读world/breach诊断，独立server trace与log保留，无完整主运行JSON或正常finally清理证据，不计成功验收。专用进程和目录单独清理。

第三次`browser-breach20-05442-2026-10-03T23-17-19-824Z.json`为标准FAIL：双端七原geometry/GA41结束/隐藏与OBB2016ms释放成立，页面HUD快照无serverTime导致专项额外门禁不发postdestroy W，未取得玩家/弹丸通行。该次正常finally保存并清理，不计完整验收。释放后隔离规划保留其余59动态覆盖，仅移除279供给已观察RELEASED状态，49×52策略确认停位到center直线可通，73×76净空计划亦可通；实际运行场未修改。

## 限制

原NAV内核、coverage collector与服务2秒淡出释放/弹丸参数仍为明确重建，原GPU像素/priority队列未恢复；实战闭环只计实际同source目标。
