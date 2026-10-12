# 3005 原软木塞地面模型

原item3005“软木塞”的D3=3005、ItemSkill1=3005。原03005.POL v200为cylinder02、36源顶点/44三角形，材质03005A.tga映射同目录原03005A.dds；发布03005.glb和03005A.png均齐。3005施放与4003受害者效果分开记录，不将118/GA20放进模型消费者。

独立未import `Trap3005Visual(scene,id,nativeMatrix)` 提供 `load():Promise<void>` 与 `dispose():void`，加载 `/Data/scnobj/03005/03005.glb`。完整矩阵输入与3003/3004相同：原坐标X反射、Quaternion转换，保留原几何/尺寸/纹理。root和mesh诊断包含groundTrapId、sourceModel=`Data/scnobj/03005/03005.POL`。移除后晚返回资产直接dispose。

`tests/trap3005-presentation-source.py` 保存原表、POL及发布资源有限来源。`tests/trap3005-visual.mts` 使用真实GLB132展开顶点/无索引44三角形，检查供给矩阵、几何保留、所有自有纹理/mesh释放及晚加载取消，输出PASS_GROUND_MODEL_MODULE_ONLY。没有普通玩家输出，不能替代正式接线与实际验收。

## 未完成范围

主线owns ground模型3005资格/事件/snapshot/正式GroundTrapsPresentation选择与owner，输入ground id/modelId3005/位置和yaw0scale1为明确重建。模型模块不提供碰撞、权限、HP、期限或FuncType5政策。原Func12/5、原ground factory未恢复；玩家放置/双端画面/Leave待主线同一普通道具流程复用，地图不另开Chrome。
