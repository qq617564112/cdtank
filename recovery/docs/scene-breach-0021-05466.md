# 0021 obj05466破坏表现

0021唯一obj05466物件125使用对应原POL与同目录c9.CVD，摧毁后播放原GA13物件位置声音，再按原Breach状态淡出隐藏。正式ScenePreview按原placement.model选择资源；四个型号各用自己的动画和纹理。

## 来源

`tests/scene-breach21-05466-native.py`完整执行4610f1加载器，取得`data\scnobj\obj05466\obj05466.pol`与同目录c9.cvd，对象+dc/+e0保存完整/破损模型，默认+e4=+dc。完整44e081→45e7b0首次切+e4=+e0；obj05466在44e0f2匹配后转44e39d，分派GA13、selector1、方向[0,0,-1]，声音位置来自对象+58。重复通知不再分派声音。原模型名比较与派生destroy实际执行；字符串格式/存储、分配器、图形设备与导航更新为明确供给边界。证据`scene-breach21-05466-native.json/.log`保留三段原指令。

原obj05466/c9.CVD为9几何节点、124三角形，全部使用obj05466.tga引用，由同目录DDS发布。`recovery/export_scene_breach21.py`发布05422/05466/05467/05468四个独立资源；SceneBreachVisual按`Data/scnobj/<源model>/c9.CVD`精确选取。

## 模块与正式接线

ScenePreview沿既有ObjectiveSnapshot.sourcePlacementId/hp/destroyedAt关闭完整模型、绘制原破损动画，使用rate1、blend1与原alpha状态；严格alpha小于0后隐藏。真实objectiveDestroyed经既有Battle→destroyObject选择GA13及原placement.position，复用正式EffectSkillSound空间声音、音量与清场生命周期。晚加入补偿动画而不重播声音；同房再战恢复完整模型、动画0与声音去重。

本片不改变服务器或协议。动态OBB/NAV覆盖、严格elapsed>2秒移除与轮次恢复沿用`scene-breach-0021.md`；原覆盖收集器和服务器规则仍是明确来源边界。

## 实际双端验收

`tests/browser-scene-breach21-05466.mjs`运行当前React入口、普通0021/Ready、两个真人账户AI托管及两个CPU，无状态、位置、HP或通知注入。同源物件125（SCN:125）两端均收到4次自然objectiveHit（54.2/54.2/54.2/37.4）和一次objectiveDestroyed，原完整POL随后切换对应c9九节点0..8，顶点数36/60/36/36/60/36/36/36/36；node0各记录14组不同实际顶点姿态。

自然捕获帧708/638，alpha分别0.9474000335/0.9494999647。声音按实际destroyObject源ID关联，物件125的GA13在[845.2885742,0,-548.6567383]播放一次，非循环，实际playing与ended，时长0.701814秒。完整模型关闭后，碎片严格alpha小于0隐藏，实际帧734/665，alpha分别-0.0001999717/-0.0256999824。

自然CPU局两端OBJECTIVE结算，73目标HP0；同房正常再战到round2，实际scene更新后物件125完整模型enabled、fading=false、hidden=false、alpha1、声音去重false，旧碎片关闭，目标满HP。双方退出后的breakables、碎片网格、效果实例、场景技能声音及战斗声音全部0。独立3285/5315/9515服务关闭。

`scene-breach21-05466-native.json/.log`及`browser-scene-breach21-05466.json/.log`为PASS，自然画面为`browser-scene-breach21-05466-natural-1.png`和`-2.png`。正式四型号消费者覆盖73条source记录；实际呈现证据分别限定各型号选定物件，不能据此声称73实例全部实际绘制或原规则完整复原。

## 范围

原通知没有独立烟尘世界效果，仅分派GA13。原priority(-1)进入绘制状态，原绘制队列排序、GPU混合像素及NAV内核未恢复。本片限定obj05466，不将四型号消费者覆盖视为全部实例实际绘制或原规则完整复原。
