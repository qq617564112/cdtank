# 0020 obj05462原破坏与普通输入通行

原0020 obj05462使用完整POL及同目录七节点c9.CVD，破坏时原44e081选择GA41一次，重复destroy保持静默。正式ScenePreview按0020/obj05462选择独立资源项及GA41；05460/61分别保留原十/六节点c9及GA12/GA41，0021资源和声音资格不变。

## 原来源与正式消费者

`scene-breach20-05462-native.json/.log`为PASS：原4610f1实际生成并加载`data\scnobj\obj05462\obj05462.pol`和同目录`c9.cvd`，44e081执行型号字符串比较、调用45e7b0切当前模型并按GA41/selector1/物件位置/方向(0,0,-1)派发。重复调用不再播放。图形设备/分配器/字符串存储与导航更新为已明确供给边界；原加载路径、型号比较和破坏指令实际执行。

`export_scene_breach20.py`在`scene-breach-0020.json`中发布独立05462七节点资源，全部节点存在，原`obj05462.TGA`由同目录DDS发布。SceneBreachVisual复用原CVD动画/顶点/材质消费者并使用显式libraryAsset。型号资格覆盖0020十一原放置；本次实际闭环限定同SCN:320。

320原geometry origin为(-395.3293762207031,0,-1438.2232666015625)，OBB中心为(-395.54638671875,19.261383056640625,-1438.48779296875)，bounds为(32.88927459716797,38.42729187011719,33.00383758544922)，原matrix约88度旋转。几何origin与包围中心分别用于声音/绘制和服务碰撞，不互相替换。

## 普通双端业务

`tests/browser-breach20-05462.mjs`使用普通tank1双账户、两个CPU、0020/Ready，由只读world驱动A/D/W、方向键、Space及S普通按键。320距共同出生点约332单位；自然命中破坏后先靠近并实际进入原footprint，再按真实距离退至至少160，停移瞄准原中心并持续射击。全部stage、实际距离、位置及按键记录，不写状态、位置、HP、时钟、胜负或相机。

`browser-breach20-05462-2026-10-03T22-58-32-540Z.json`及`browser-breach20-05462-run1.log`完整PASS，记录同320双端原完整POL→七原c9节点实际绘制、姿态变化、GA41播放结束及渐隐隐藏。双端`-natural-1.png`和`-natural-2.png`可辨原黑色碎片；黄色角色射击效果不作为c9来源。画布为软件320×180，浏览器使用默认音频策略。

原覆盖INTACT→FADING tick184→RELEASED tick224，完整及渐隐阶段原OBB/NAV保留，释放后原NAV格恢复与OBB解除。存活普通输入P1/P4在tick266实际进入原旋转footprint；存活弹丸B52在tick336的World.step前后持续存在并跨原OBB。两个通行条件独立成立；普通输入控制人类账户不能称作内建CPU。

双端七节点完整捕获帧303/261，alpha分别0.9056500196456909/0.9086999893188477；GA41实际playing/ended、duration0.948435秒、loop=false，原origin位置一致。权威释放elapsed为2014ms；170条普通导航按键/实际距离样本保存。

## 自然再战与离房

同一完整运行按snapshot.remaining163秒加15秒等待自然FINISHED，再双人普通Rematch进入round2。源320完整模型、alpha1、HP及声音去重复位，原c9停绘，原动态OBB/NAV重新阻挡。双端普通Leave后breakables、brokenMeshes、effect instances、scene voices、battle voices均0；最后真人离房删除round2房间，activeDynamicBoxes0。3293/5323/9523、临时账户库及浏览器目录清理。

## 限制

原NAV格内核、覆盖收集器、两秒完整bounds与服务玩法/弹丸规则保持明确重建。原GPU混合像素/priority队列未知；实际范围只同320，不将其它型号或全部十一放置计作实战验收。
