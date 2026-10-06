# 0021木桶破坏表现

普通破坏模式0021中，obj05467木桶使用原完整POL，摧毁时切换同目录c9.CVD六节点碎片动画，播放原GA13物件位置声音，并按原状态淡出隐藏。正式ScenePreview消费服务器原placement ID及destroyedAt；Battle只在真实objectiveDestroyed事件调用声音消费者。62个obj05422、1个obj05466、8个obj05467与2个obj05468记录采用对应原模型切换，其他0021破坏模型保留现有淡出合同。obj05422、obj05466和obj05468来源及实际验收分别见`scene-breach-0021-05422.md`、`scene-breach-0021-05466.md`、`scene-breach-0021-05468.md`。

## 原来源

完整4610f1加载入口通过5c78d4格式`%s\\%s\\%s.pol`生成`data\\scnobj\\obj05467\\obj05467.pol`并保存到+dc；5c7910格式`%s\\%s\\c9.cvd`生成同目录c9.cvd并保存到+e0。默认+e4选择+dc。原gbGeomNode设置时间0、先update、TimeScale1、AnimLoop1、BlendRecursive(1,1)与RenderPriority(-1)。现存c9.CVD包含6几何节点、126三角形，使用原obj05467.TGA引用，由同目录obj05467.dds发布。

原44e081检查隐藏状态，再调用派生破坏槽+14。Breach45e7b0首次设置+e8、alpha1、+e4=+e0，设置原混合并立即调用462846；重复破坏返回false，不再分派声音。obj05467在44e106匹配并跳到44e39d，声音为GA13，经485b1b播放一次，位置直接来自对象+58，方向[0,0,-1]。完整通知没有独立烟尘世界效果调用；碎片由c9.CVD呈现。

`tests/scene-breach21-native.py`完整执行4610f1、44e081、45e7b0及462846/461ded，输出原加载路径、模型选择、一次声音和导航回调顺序。字符串格式/存储、分配器、图形设备、覆盖收集与地图虚接口为明确供给边界。原MSVC模型名比较实际执行。重复通知不播放GA13。证据`scene-breach21-native.json/.log`包含6段原指令。

## 模块与正式接线

`recovery/export_scene_breach21.py`发布`scene-breach-0021.json`；正式assets:scenes入口调用它。SceneBreachVisual按原placement.model选择独立c9资源，复用原CVD轨道、顶点、材质和纹理采样实现；销毁前动画时间0且不绘制，销毁后rate1、blend1、alpha按SceneBreachState更新。完整POL在切换时关闭，c9严格alpha小于0后停止绘制。晚加入使用destroyedAt补偿动画和淡出时间；轮次变化重置原完整模型、动画0和声音去重。

ScenePreview.destroyObject(sourcePlacementId, runtime)只对本片已载木桶调用EffectRuntime.playSceneSound('GA13',原placement.position)。声音使用正式EffectSkillSound的空间声音、全局音量与清场生命周期；不创建第二个音频context。源位置与Web反射转换在现有backend保持。

## 导航与碰撞边界

45e7b0在切换模型后立即进入462846。虚槽28读取子数据首byte；槽64读取field88(+88)。field5c不是这一导航门禁。门禁允许后收集覆盖，再由461e61调用地图virtual20(+90,+a0)，通过4581b8派发槽58=461ded：地图virtual24清理range0..INT_MAX，随后virtual2c(+90,field8c)，原Breach构造field8c=1。最后子数据首byte清零。

本片原执行证明清理后还有apply(value1)，不能推导摧毁时立即完全可通。覆盖收集器、影响对象集合、地图格更新和破损模型包围计算未恢复。服务器每房独立的动态OBB/NAV覆盖使用原完整placement bounds，为明确重建provider；毁后保留至严格elapsed>2秒再移除，轮次恢复，不修改原.box或NAV数据。c9几何随动画变化，不拿静态碎片包围替代未恢复的原收集器。

## 实际双端验收

`tests/browser-scene-breach21.mjs`运行当前React入口、独立账户、正常Ready及两个真人账户AI托管加两个CPU，mode5/0021没有状态、位置、HP或通知注入。`browser-scene-breach21.json/.log`为PASS；自然画面保存为`browser-scene-breach21-natural-1.png`与`-2.png`。

实际验收对象是同一sourcePlacementId63的obj05467木桶（SCN:63）：两端均收到4次自然objectiveHit，伤害54.2/54.2/54.2/37.4以及一次objectiveDestroyed；两端都先提交完整POL，再提交c9全部六节点，节点0..5顶点数120/90/36/36/60/36；节点0有15组不同实际顶点姿态。自然捕获帧745/683，alpha分别0.8101500273/0.8217499852。完整模型在碎片阶段关闭，alpha严格小于0后碎片隐藏。源GA13在[390.0637817,0,358.1900940]一次播放，非循环，实际playing与ended，原WAV时长0.701814秒。模块覆盖8个obj05467放置记录，本片双端完整呈现验收限定木桶63。

继续普通CPU自然对局，两端结果OBJECTIVE、73目标HP0。正常双方同房再战进入round2，在真实scene更新后木桶63完整模型enabled、fading=false、hidden=false、alpha1、声音去重false、旧碎片网格关闭；新轮次全部目标满HP。双方退出后的breakables、碎片网格、效果实例、场景技能声音、战斗声音均为0。独立3282/5312/9512服务均已关闭。

原priority(-1)已保留到绘制状态，EffectModelRenderer尚未实现原绘制队列排序。原GPU混合像素与完整碰撞/NAV内核未逐帧对照；本片完成选定木桶的源模型、动画、声音与正式业务生命周期，不扩大到其他破坏模型或全内容原规则。

普通双网页原0021同SCN:62的c9/GA13、完整与渐隐覆盖、释放后实际CPU进入和存活弹丸穿越，以及普通再战恢复/离房清理，另见[0021实际通行与弹丸穿越](scene-breach-0021-collision-b.md)及`breach21-collision-b-actual.json`。该专项不改变原NAV内核未恢复的来源边界。

