# 0020 obj05460普通键盘破坏与通行

普通双网页同SCN:319已完成原十节点c9/GA12、渐隐隐藏、原OBB/NAV释放、两个普通输入玩家进入及存活弹丸通行；独立普通专项完成自然结算、round2恢复与离房清理。

原资源首件已通过：obj05460 的原POL/c9加载和破坏分支GA12一次播放见 `scene-breach20-05460-native.json`，发布库为 `scene-breach-0020.json`。正式 `ScenePreview` 只在0020的obj05460选择该库和GA12，0021仍使用各自资源库与GA13。

普通双网页0020运行已保留两次FAIL记录：`browser-breach20-05460-run1.json`与`browser-breach20-05460-2026-10-03T22-23-21-861Z.json`。第一轮实际产生05460放置319、292、333、277、318、299的自然破坏/释放，以及两次释放后的普通弹丸穿越，但没有存活CPU进入同一选定footprint，双端同目标c9/GA12捕获条件未闭合。第二轮增加普通W/A/D移动输入跟随277的自然位置，仍未形成同一目标双端c9/GA12、释放和通行闭环。

这些运行不证明0020的正式战斗闭环通过，也不把其它型号或0021证据转用于05460。原NAV内核和破坏后的通行规则保持明确重建边界。

## 普通键盘导航首件

`tests/browser-breach20-05460.mjs`已将导航直接接入正式验证流程，Ready后两个人类账户使用普通A/D转向、方向键炮塔瞄准、Space射击及W前进；按实际world快照闭环更新并记录全部按键、实际位置、yaw/aim和目标HP。首件选319：两端原出生点均为(-304.71,-1119.34)，319中心为(-364.59063720703125,-1344.2447509765625)，约233单位；277约1300单位，不再作为近距双端首件。

改良运行`browser-breach20-05460-2026-10-03T22-32-36-737Z.json`保留整体FAIL，失败条件为普通mode5在120秒结算窗口未自然结束。其同SCN:319破坏阶段已实际闭合：两端原完整POL→十节点obj05460/c9.CVD、动画姿态变化、GA12实际playing/ended、渐隐隐藏均记录；`-natural-1.png`和`-natural-2.png`中的原破损几何可见。截图为软件320×180画布，黄色角色射击效果不作为c9来源。

同目标权威时钟在tick99进入FADING，tick139释放；release.serverTime−destroyedAt为2021ms。原格fields6保持，valid由false恢复true，原OBB命中解除，navigationRevision由7增至8。释放后tick166/168，存活人类账户P1/P4通过普通输入进入原旋转OBB水平footprint；记录标记ordinaryPlayerInput=true，不能称作内建CPU。tick180，同一实际弹丸B26（ownerP1）在World.step前后存活，从原范围内继续前进，fraction0，原OBB释放后的实际弹丸通行成立。

本轮共有78条普通导航样本；破坏阶段完成后才通过正常AI托管继续对局。120秒自然结算窗口未结束，因此没有round2恢复与普通Leave验收，不将整体FAIL改为PASS。该整体FAIL原样保留，轮次恢复及离房采用下述独立普通专项。

## 普通再战与离房专项

`browser-breach20-05460-2026-10-03T22-37-01-723Z.json`为PASS。`--rematch-leave-only`使用普通0020双账户和CPU/AI托管，finishWait按真实snapshot.remaining180秒加15秒等待，不改变服务器时限或规则。两端正常FINISHED、remaining0后普通Rematch进入round2；同319完整模型恢复、alpha1/fadingfalse/hiddenfalse、soundPlayedfalse，原c9网格停绘，目标HP恢复。原七个05460覆盖恢复，同319原格validfalse及原OBB命中恢复。

双端普通Leave后breakables、brokenMeshes、effect instances、scene voices及battle voices均0；最后真人离房删除round2房间，activeDynamicBoxes0。3291/5321/9521和临时账户/浏览器目录均已清理。

## 独立验收

`python3 tests/breach20-05460-actual.py recovery/output/browser-breach20-05460-2026-10-03T22-32-36-737Z.json recovery/output/browser-breach20-05460-2026-10-03T22-37-01-723Z.json`通过。结果为`breach20-05460-actual.json/log`，强制验证同319双端十节点原c9、GA12 playing/ended、原93度旋转OBB内的存活玩家、同一存活弹丸实际穿越两项同时成立，以及独立自然再战恢复与离房清理。该PASS不改写原破坏段整体FAIL。

## 限制

破坏通行段整体FAIL与再战离房段PASS独立保留，不改写任一原记录。原NAV格内核、覆盖收集器与服务器伤害/玩法规则仍为重建；本首件只覆盖05460同319，不扩展其它型号、全部地图或原GPU像素。
