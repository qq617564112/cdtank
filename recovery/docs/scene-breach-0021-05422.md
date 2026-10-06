# 0021 obj05422破坏表现

0021的obj05422使用原完整POL和同目录c9.CVD，摧毁后播放原GA13物件位置声音并按原Breach状态淡出隐藏。正式ScenePreview按placement.model选择对应资源；05467、05468保留各自c9与纹理。模块覆盖0021的62条obj05422放置记录。

## 来源

`tests/scene-breach21-05422-native.py`完整执行4610f1加载器，取得`data\scnobj\obj05422\obj05422.pol`及同目录`c9.cvd`，对象+dc/+e0保存对应模型，默认+e4=+dc。完整44e081→45e7b0首次把+e4切为+e0，模型名obj05422在44e0b6匹配后跳到44e39d，分派GA13、selector1、方向[0,0,-1]；声音位置来自对象+58。重复通知不再分派声音。字符串格式/存储、分配器、图形设备与导航更新为明确供给边界；原模型名比较及派生destroy实际执行。证据`scene-breach21-05422-native.json/.log`保留三段原指令。

实际obj05422/c9.CVD包含10几何节点、72三角形，使用唯一原obj05422.TGA引用，由同目录obj05422.dds发布。`recovery/export_scene_breach21.py`将05422/05466/05467/05468作为四个独立资源写入`scene-breach-0021.json`；SceneBreachVisual按完整原reference选取，不借用别的模型动画或纹理。

## 模块与正式接线

ScenePreview沿已有ObjectiveSnapshot的sourcePlacementId、hp、destroyedAt切换模型，原完整模型关闭、对应c9以rate1/blend1与原alpha状态绘制，严格alpha小于0后隐藏。真实objectiveDestroyed通过既有Battle→destroyObject分派GA13和原placement.position，复用现EffectSkillSound空间声音、音量与清场生命周期。晚加入按destroyedAt补偿而不重播声音；同房再战恢复完整模型、动画0及声音去重。

本片不修改服务器或协议。每房动态OBB/NAV覆盖、严格elapsed>2秒移除、轮次恢复与CPU自然对局证据沿用`scene-breach-0021.md`及`breach21-world.json`。

## 实际双端验收

`tests/browser-scene-breach21-05422.mjs`使用当前React入口、普通0021/Ready、两个真人账户AI托管与两个CPU，无状态、位置、HP或通知注入。完整呈现验收限定共同sourcePlacementId131（SCN:131）的obj05422：两端均收到4次自然objectiveHit（54.2/54.2/54.2/37.4）及一次objectiveDestroyed，实际完整POL切换对应c9十节点0..9，顶点数48/36/24/12/12/24/12/24/12/12。node0有7/13组不同实际顶点姿态；自然捕获帧449/376，alpha分别0.4278999865/0.8700500131。

声音按真实destroyObject调用的源ID关联：物件131的GA13在[109.3353119,0,-333.5581665]播放一次、非循环，实际playing与ended，原时长0.701814秒。完整模型关闭后，碎片严格alpha小于0隐藏，实际帧459/398，alpha分别-0.0076500066/-0.0242000185。模块覆盖62条obj05422记录，完整双端呈现验收限定物件131。

自然对局两端以OBJECTIVE结算，73目标HP0；同房正常再战round2在实际scene更新后恢复物件131完整模型enabled、fading=false、hidden=false、alpha1、声音去重false，旧碎片关闭，目标满HP。双方退出后的breakables、碎片网格、效果实例、场景技能声音、战斗声音全部0。独立3284/5314/9514服务均关闭。

`scene-breach21-05422-native.json/.log`与`browser-scene-breach21-05422.json/.log`为PASS，实际画面为`browser-scene-breach21-05422-natural-1.png`与`-2.png`。

## 范围

原44e081只分派GA13，没有独立烟尘效果。原priority(-1)已进入绘制状态，实际绘制队列排序、GPU混合像素、原NAV内核与服务器规则仍保持父项来源边界；不扩大到其他模型。
