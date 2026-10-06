# 0020 obj05461原破坏与普通输入通行

原0020的obj05461完整POL切换同目录六节点c9.CVD，原44e081按该型号分派GA41一次，重复破坏不再播放。正式ScenePreview精确按0020/obj05461选择独立资源及GA41；obj05460保持其十节点c9和GA12，0021四型号保持原各自资源与GA13。

## 原来源与消费者

`scene-breach20-05461-native.json/.log`为PASS：完整4610f1实际格式化并加载`data\scnobj\obj05461\obj05461.pol`及`c9.cvd`，完整44e081调用派生45e7b0切+e4至破损模型、设置blend1/alpha1并执行型号字符串比较，选GA41/selector1/原物件位置及方向(0,0,-1)。重复destroy无声音。字符串存储、分配、图形设备及NAV更新沿既有明确供给边界；原模型比较与破坏指令实际执行。

`export_scene_breach20.py`发布独立`Data/scnobj/obj05461/c9.CVD`资源至`scene-breach-0020.json`，实际六节点全部存在，原`obj05461.TGA`使用同目录DDS发布；原05460资源保持在同库独立项。SceneBreachVisual使用显式libraryAsset，原动画与纹理消费者复用已有来源，不借用05460动画/GA12或0021 GA13。地图20的21个05461放置具备正式模型资格，本次实际闭环限定同SCN:274。

## 普通输入与实际阶段

`tests/browser-breach20-05461.mjs`使用普通tank1双账户、两个CPU、0020/Ready，直接由只读world驱动普通A/D/W、方向键与Space。选择距离共同出生点约294单位的274；原origin为(-35.65769958496094,-0.00003051759995287284,-999.6281127929688)，原bounds为(30.823383331298828,37.75355911254883,30.49988555908203)。不写位置、HP、时钟、终局或相机。

破后通过实际距离和普通KeyS后退，达到至少160单位后停移，重新瞄准原中心并Space射击。全部导航stage/距离/按键与实际角色位置保存；通行必须同时满足存活角色进入原旋转footprint和实际存活弹丸穿过原OBB，不以NAV查询替代实战轨迹。浏览器默认音频策略、软件framebuffer320×180。

首份`browser-breach20-05461-2026-10-03T22-45-52-805Z.json`整体FAIL原样保留：两端274原六节点c9/GA41/隐藏及两普通输入玩家进入成立，但没有释放后的存活弹丸通行记录。原小footprint半宽约15，近中心炮口位于原包围外；对应普通后退射击输入的实际距离记录单独保留。

针对性复验`browser-breach20-05461-2026-10-03T22-49-39-834Z.json`整体PASS，其双端`-natural-1.png`和`-natural-2.png`均可辨原c9黑色碎片，角色射击的黄色效果不作为c9证明。同274两个普通输入玩家在tick176/177进入释放后原footprint，身份ordinaryPlayerInput=true；存活弹丸B34在tick243实际跨原OBB。普通输入角色不能称作内建CPU。

双端原六节点c9完整捕获帧214/161，alpha分别0.7893500328063965/0.8396499752998352；原GA41实际playing/ended，duration0.948435秒、loop=false，声音位置与原origin一致。权威INTACT/FADING/RELEASED为tick1/91/131，释放时serverTime−destroyedAt为2015ms，原OBB与NAV占用解除，完整/渐隐阶段仍保留。

## 自然再战与离房

同一完整PASS运行按snapshot.remaining168秒加15秒等待普通自然FINISHED，然后双人普通Rematch进入round2。原完整模型、HP、alpha1与声音去重复位，旧c9网格停绘，同274原动态OBB/NAV重新阻挡。两端普通Leave后breakables、brokenMeshes、effect instances、scene voices及battle voices均0；最后真人离房删除round2房间，activeDynamicBoxes0。3292/5322/9522和临时账户库/浏览器目录清理。

## 限制

原NAV格内核、覆盖收集器和破坏后两秒原完整bounds策略仍为重建；原GPU混合像素/priority队列未恢复。本片只覆盖05461同274，不宣称其它型号、全部放置或原玩法规则完整恢复。各实际运行状态分别保留，失败运行不改写为PASS。
