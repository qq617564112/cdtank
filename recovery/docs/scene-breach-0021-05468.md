# 0021 obj05468破坏表现

0021的obj05468使用对应完整POL和同目录c9.CVD，摧毁时播放原GA13物件位置声音，再按原Breach状态淡出隐藏。正式ScenePreview按原模型选择资源；已有obj05467保留自己的c9与纹理。模块覆盖sourcePlacementId62、67两条obj05468放置记录。

## 来源

`tests/scene-breach21-05468-native.py`完整执行4610f1加载器，取得`data\scnobj\obj05468\obj05468.pol`及同目录`c9.cvd`，对应对象+dc/+e0，默认+e4=+dc。完整44e081→45e7b0把+e4切到+e0，首次通知经44e11a→44e39d分派GA13，方向[0,0,-1]、selector1，声音位置来自原对象+58；重复通知不再播放。字符串格式/存储、分配器、图形设备与导航更新为明确供给边界。原模型名比较和派生destroy实际执行，证据`scene-breach21-05468-native.json/.log`保留三段原指令。

实际obj05468/c9.CVD包含六几何节点、96三角形，全部使用obj05468.TGA引用，由同目录obj05468.dds发布。`recovery/export_scene_breach21.py`把05422、05466、05467和05468作为四个独立资源写入`scene-breach-0021.json`。SceneBreachVisual按`Data/scnobj/<源model>/c9.CVD`精确选择，不借用另一型号动画或纹理。

## 模块与正式接线

ScenePreview沿已有ObjectiveSnapshot.sourcePlacementId、hp、destroyedAt切换模型；原完整模型关闭，破损c9以rate1、blend1及原alpha状态绘制，严格alpha小于0后隐藏。真实objectiveDestroyed经Battle调用既有destroyObject，选择GA13和原placement.position，复用现EffectSkillSound空间声音、音量与清场生命周期。晚加入不重播声音，并按destroyedAt补偿动画；同房再战重置完整模型、动画0与声音去重。

服务端规则没有本片变化。每房动态OBB/NAV覆盖、严格elapsed>2秒移除与轮次恢复，以及CPU自然对局证据复用`scene-breach-0021.md`和`breach21-world.json`。原导航回调存在清旧覆盖后apply1，不将原模型切换解释为立即完全可通。

## 实际双端验收

`tests/browser-scene-breach21-05468.mjs`使用当前React入口、普通0021/Ready、两个真人账户AI托管与两个CPU；没有位置、HP、状态或通知注入。完整呈现验收限定同一个sourcePlacementId62（SCN:62）的obj05468：两端各收到4次自然objectiveHit（54.2/54.2/54.2/37.4）及一次objectiveDestroyed，实际先后提交完整POL与对应c9的六节点0..5，顶点数48/36/72/36/48/48。node0记录13组不同实际顶点姿态。自然捕获帧817/757，alpha分别0.9021499753/0.9255500436；完整模型关闭，碎片随后在严格alpha小于0时隐藏。

声音记录按真实destroyObject调用的sourcePlacementId关联，物件62的GA13在[386.4195557,0,437.2084961]播放一次、非循环，实际playing与ended，原时长0.701814秒。模块覆盖物件62、67两条记录，不把其他模型的GA13计入物件62验收。

普通CPU自然局两端以OBJECTIVE结算，73目标HP0；同房正常再战到round2，在实际scene更新后物件62完整模型enabled、fading=false、hidden=false、alpha1、声音去重false，旧碎片关闭，目标满HP。双方离房后的breakables、碎片网格、效果实例、场景技能声音与战斗声音计数全部0；独立3283/5313/9513服务关闭。

证据`scene-breach21-05468-native.json/.log`及`browser-scene-breach21-05468.json/.log`为PASS，自然画面为`browser-scene-breach21-05468-natural-1.png`与`-2.png`。

## 范围

本片原通知仅分派GA13，没有独立烟尘世界效果。原priority(-1)进入绘制状态，实际队列排序、GPU混合像素及原NAV/服务器规则内核尚未恢复；不扩大到其他场景模型。
