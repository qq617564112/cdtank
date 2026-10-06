# 0018原obj05424木箱破坏

map18十八个原obj05424木箱已接独立破损库`scene-breach-0018.json`和现有SceneBreachVisual。原型号入口执行确认完整`obj05424.pol`切换到同目录`c9.cvd`；44e081首次派发GA13、selector1、原物件位置，重复派发静默。原材质、纹理、十节点与轨道来源核验通过。普通双网页近身输入已击破同一87号木箱，两端同帧实际绘制全部十个原碎片节点，原木板在真实画面可辨认，GA13播放一次到结束，碎片淡出隐藏；正常前进进入旧箱体范围。默认300秒局自然TIME_LIMIT已实测；独立60秒正常网络验收局验证同房再战、十八模型/血量与声音去重恢复、最终离房五资源计数均0，联合独立验收PASS。

## 原资源与正式消费者

原`Data/scnobj/obj05424/c9.CVD`十个节点均独立根且有几何，每个13顶点帧、四三角形，共40三角形，duration0.800000011920929秒。局部顶点帧完全相同；十节点position与rotation轨道变化，scale按原节点保留静态或动态值，世界碎片运动来自原轨道。

`tests/scene-breach18-05424-native.py`执行原4610f1 loader、44e081 destruction选择与声音入口，POL/c9载入、broken切换、GA13首次/重复静默PASS。字符串格式存储、allocator与设备方法为记录边界；既有navigation更新边界复用。

`tests/scene-breach18-05424-source.py`逐值核十节点parent、frames/times、position/rotation/scale/value、parts完整数量/kind/indices及17个材质值。原DDS到发布PNG decodedRGBA逐像素相同；原GA13.wav发布字节相同，duration0.701814059秒。map18十八个木箱全部来源字段与正式GLBasset不变，破损库独立只有05424。

生产改动限于新`export_scene_breach18.py`、`export_scenes.py`导出调用，以及ScenePreview在map0018/modelobj05424选择`/scene-breach-0018.json`。既有GA13分派经本型号原入口确认可复用。正式独立sceneObjects HP/destroyedAt与sceneObjectDestroyed事件、动态OBB/NAV及ScenePreview状态由root业务接线。

## 普通实战与可见图像

普通mode4/map18默认四人资格由两个正式网页与两个正常协议玩家满足。辅助玩家通过Account、Join、Ready加入并静止，不用CPU，不写房间或玩家状态。两个网页正常W/A/D驶近原87木箱，真实位置受完整箱体阻挡；正常S倒车让出碎片视线后，用Space五次实际命中43/43/43/43/28，双方同步一次sceneObjectDestroyed。双端实绘来自默认300秒局；双网页与保持正式心跳的辅助玩家在独立60秒验收局正常击破同87后，通过正常Rematch与Leave完成生命周期。实际为两网页640×360及两个认证协议玩家，原raw旧scope文本中的网页数/分辨率不用于接受资格。

`tests/observers/scene-breach18-05424-browser.mjs`只记录正式执行结果，包括完整POL与破损source meshes、全部XYZ/UV/indices、原clock矩阵/placement、实际相机与canvas、正式事件、GA13 playing/ended及fade状态。观察不写玩家/HP/位置/相机/clock、不注入事件；网页软件画布640×360。

本片双端同帧capture均为十个原几何节点，全部碎片运动按真实clock原轨道采样。hostframe403和guestframe331原canvas中可辨木板碎片，部分原图同时可见烟尘。actualcamera view/projection定位源碎片投影，原图审查确认可识别范围。完整节点提交不声称每个重叠表面都分别暴露。

`tests/scene-breach18-05424-actual.cts`独立核原placement线性部分与position平移、十源节点矩阵和全部提交世界XYZ、UV、indices、原05424纹理以及identity mesh worldMatrix；从capture真实clock独立投影全部十源节点，列出原生预期与实际节点集合。正式声音按原position/GA13/selector1核一次playing-ended，正式淡出与hidden核实际状态。正常W后的玩家点与原源OBB核实际进入资格。

## 普通生命周期与证据

`browser-breach18-05424-2026-10-04T04-14-27-017Z.json`保留整体FAIL，独立接受双端完整source draw/canvas、GA13、fade、正常进入旧OBB及默认300秒TIME_LIMIT有效段。

`browser-breach18-05424-2026-10-04T04-24-42-831Z.json`独立生命周期PASS，明确验收配置timeLimit60秒、默认minimum4。双方普通输入击破同87、GA13结束/hidden，真实TIME_LIMIT后四玩家正常同R6再战round2；两端十八个sceneObjects恢复200HP无destroyedAt，十八模型alpha1/fadingfalse/hiddenfalse/intactEnabledtrue/soundPlayedfalse。采样等待实际渲染恢复；SceneBreachVisual.reset隐藏破损renderer的既有合同复用，不额外声称新brokenEnabled实数计数。正常Leave后两端breakables/brokenMeshes/effect instances/scene voices/battle voices均0。

`scene-breach18-05424-actual.json`联合核两个原记录，保留各原整体状态；全部十节点各三个世界姿态，全XYZ/matrix误差0，实际相机投影与原图候选审查PASS。记录原箱前两端普通W停滞，后host正常W2200ms从(504.91,−512.15)进入原OBB至(614.13,−443.51)。serverTrace旧observer范围为mode5/map20/21，不将空trace宣称本片网络碰撞追踪。正式权威通行规则另有`environment-world-collision.json`正常输入证据。

## 证据与接受范围

| 产物 | 范围 |
| --- | --- |
| `scene-breach18-05424-native.json/.log` | 原型号loader、broken选择与GA13一次/重复静默，PASS |
| `scene-breach18-05424-source.json/.log` | 原十节点/材质/DDS/GA13与十八原放置，PASS |
| `browser-breach18-05424-2026-10-04T04-14-27-017Z.json` | 双端同87原实绘/声音/通行与默认300秒结算有效段 |
| `browser-breach18-05424-2026-10-04T04-24-42-831Z.json` | 独立60秒配置正常击破/再战/离房PASS |
| `scene-breach18-05424-accepted-index.json` | 独立有效段联合接受索引，原状态不覆盖 |
| `scene-breach18-05424-actual.json/.log` | 同87双端原碎片来源、原声音、淡出、通行与生命周期独立验收 |
| `scene-breach18-05424-visual-review.json` | 实际相机投影、原canvas与原像素碎片候选审查 |

未接受的普通运行原状态保持原文件，不覆盖为PASS；同源资源与原入口资格只取上述独立source/native证据。辅助协议玩家和网页生命周期按实际正常请求列入记录。

## 限制

环境200HP、弹丸伤害及动态OBB/NAV释放调度为明确重建业务，不声称原服务器规则。原未知非致死producer、油桶及其他地图不在本片。软件640×360可识别原资源不证明原Windows GPU像素一致或高清性能；18实例来源恢复不等于18实例逐个破坏视觉均验收。
