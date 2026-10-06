# 0018原obj05442油桶破坏

map18十六个原obj05442油桶接入独立破损库`scene-breach-0018.json`和现有SceneBreachVisual。原型号loader与破坏入口确认完整POL切换到同目录`c9.CVD`；首次派发原GA41、selector1、原物件位置，重复派发静默。八个原序列化节点、七个几何节点、原轨道、材质、纹理和声音来源核验PASS。普通双网页击破同一43号油桶，两端同帧实绘七个原几何节点，原油桶碎片可辨，GA41一次播放到结束并淡出隐藏；正常前进进入旧油桶OBB。显式120秒验收配置自然TIME_LIMIT，同房再战恢复34个环境物件及十六个油桶视觉，正常离房五项资源计数均0，独立验收PASS。

## 原资源与正式消费者

原`Data/scnobj/obj05442/c9.CVD`包含八个根节点槽。node0为无动画、无几何的空根，保留原槽位与identity矩阵；node1–7为七个独立几何根。每个几何节点25个局部顶点帧，duration0.800000011920929秒；各节点的局部顶点帧完全相同，世界碎片运动来自原position、rotation及scale轨道。七节点三角形数依次为8、10、10、18、10、4、10，共70。

`tests/scene-breach18-05442-source.py`逐值核全部节点parent、frames/times、position/rotation/scale/value、parts数量/kind/indices及17个材质值。原`obj05442.tga`引用解析同目录DDS，发布PNG的decodedRGBA与原DDS逐像素相同；发布GA41.wav与原WAV字节相同，duration0.9484353741496598秒。map18十六个原放置的来源字段与完整模型GLB不变。

本型号复用`scene-breach20-05442-native.json`的原POL/c9 loader、破坏选择与GA41一次/重复静默，以及`scene-breach20-05442-empty-native.json`的原空根槽、identity指针和矩阵证据。发布0018库的05442资源逐值等于既有0020库同源资源。

生产资源改动限于`export_scene_breach18.py`增加本型号原c9，以及ScenePreview在map0018/modelobj05442选择`/scene-breach-0018.json`。既有GA41分派按本型号原入口复用。正式独立sceneObjects HP/destroyedAt、sceneObjectDestroyed事件、动态OBB/NAV与ScenePreview状态接入本型号。

## 普通碰撞与生命周期

map18普通mode4包含34个环境物件，十八个木箱和十六个油桶。普通World输入证据`environment-world-43.json`及`environment-world-collision-43.json`确认43号原油桶完整时阻挡正常W；真实发射累计200伤害后破坏，淡出2000ms内仍阻挡，超过2000ms后正常前进穿越旧OBB。正常环境命中不计玩家击杀或得分，也不附加范围伤害。显式120秒验收配置自然TIME_LIMIT，同房Rematch恢复完整环境物件，正常Leave释放资源。

## 普通双网页实绘

普通mode4/map18默认四人资格由两张正式网页与两个认证协议玩家满足。host创建房间后guest正常Join，再让两个辅助玩家通过Account、Join、Ready加入并维持正式心跳；未修改最低人数。两网页为640×360软件画布，正常W/A/D前进至完整油桶受阻，正常S倒车后host用Space实际命中43/43/43/43/28，两端同步同一次sceneObjectDestroyed。观察器只读正式执行的几何、clock、相机、canvas、事件、声音和淡出状态；没有写入位置、HP、相机、clock或注入事件。

`browser-breach18-05442-2026-10-04T04-39-49-191Z.json`整体PASS。hostframe602、guestframe518同时包含全部七个原几何节点；各节点采集三个不同世界姿态。`tests/scene-breach18-05442-actual.cts`按原placement、真实clock和原轨道独立核全部XYZ、UV、indices、纹理及矩阵，双端最大XYZ误差0、matrix误差0；empty node0保持空槽且不提交几何。原GA41按原放置位置、selector1播放一次到结束，duration与原WAV一致；完整模型关闭、碎片fade及hidden均记录实际状态。

实际相机view/projection独立投影七个源节点至原canvas。两张完整画面与投影候选裁图中可辨原深灰油桶壁板和圆形盖纹理，旁有原爆炸光与烟尘；部分表面被正常坦克轮廓遮挡。全部七节点实际提交资格与原像素可识别资格分别保存在actual及visual-review证据中。

完整源油桶阻挡点为host(406.43,−932.38)、guest(401.65,−939.47)，两端普通W连续受阻。碎片hidden后host正常W2200ms从(336.68,−885.58)进入原油桶OBB至(441.31,−955.78)。自然120秒TIME_LIMIT后，两个辅助玩家仍连接，四玩家正常Rematch使同R6进入round2；两端34个物件全部恢复200HP且无destroyedAt，十六个油桶恢复alpha1、fadingfalse、hiddenfalse、完整模型启用与声音去重清空。采样等待实际渲染恢复。正常Leave后两端breakables、brokenMeshes、effect instances、scene voices、battle voices均0。

## 证据

| 产物 | 范围 |
| --- | --- |
| `scene-breach18-05442-source.json/.log` | 八槽/七几何、原材质/DDS/GA41与十六放置来源，PASS |
| `scene-breach20-05442-native.json` | 同型号原POL/c9 loader、broken选择与GA41一次/重复静默，PASS |
| `scene-breach20-05442-empty-native.json` | 同型号原空根槽与identity指针/矩阵，PASS |
| `environment-world-43.json` / `environment-world-collision-43.json` | 正常World命中、完整/淡出阻挡及释放后通行，PASS |
| `browser-breach18-05442-2026-10-04T04-39-49-191Z.json` | 普通双网页源43实绘/声音/通行、120秒自然结算、再战/离房，PASS |
| `scene-breach18-05442-actual.json/.log` | 双端全部七源节点/三个世界姿态、原声音、淡出、通行与生命周期独立验收，PASS |
| `scene-breach18-05442-visual-review.json` | 实际相机投影、原canvas与碎片候选像素审查，PASS |
| `scene-breach18-05442-accepted-index.json` | 同run完整接受索引，原raw整体状态PASS |
| `scene-breach18-05442-process-cleanup.json` | 专用3309/5339/9539无监听、临时目录已清理，PASS |

## 限制

环境200HP、弹丸伤害与动态OBB/NAV释放调度为重建业务，不声称原服务器规则。软件640×360画布不证明原Windows GPU像素一致或高清性能；十六实例来源恢复不等于十六实例逐个破坏视觉均验收。原未知非致死producer及其他地图不在本片。
