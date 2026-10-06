# Map20 原地形烘焙色消费者

原0020.POL含64mesh、190分片：FVF21，139kind0/51kind1。已发布GLB28434展开顶点的UV/packedRGBA逐源值一致，16013非白原颜色，原纹理无缺失。正式0020地形已接原texture×packedDiffuse材质，以原数据替换PBR照明表现。

独立export_scene_terrain20_material按190原mesh/kind发布精确geom_c1/geom_t_c1资格，复用2/18/11/7已验selector与SceneTerrainMaterial消费者。共享修改限export_scenes独立import/call、ScenePreview与SceneTerrainMaterial仅0020资格，不改General/ground/Crush/事件/碰撞规则。

正常mode5/map20选图建房加入→普通出生W/A→真实材质draw及两完整画布→Leave采worldnull/ownerfalse/material0；GPU队列为UIcaret尾段→sideTank六值用户QUERY→map20，按清理信号交接，不重复旧route或逐190截图。

## 未完成范围

source inputs、生产接线及真实GLB模块已通过，唯一首raw `browser-scene-terrain20-2026-10-05T04-00-10-537Z.json` PASS：双普通W/A各有实际位移，真实draw77片(54opaque23alpha)/74片(54opaque20alpha)，339/141次，其中52/50片含原非白RGBA。两完整1280×720natural已亲看原夜景道路/铺砖/路缘/栅栏透明轮廓，坦克/栅栏自然遮挡保留。双Leave ownerfalse/material0且先等待worldnull；process/temp及3478/5508/9708全清。索引scene-terrain20-material-player-evidence.json待主审。190材质数据覆盖不代表190逐片像素；原CW/device精度、全地图/HD父项保持开放，不以原材质替代服务器碰撞或玩法授权恢复。

共享导入窗口已获主线明确release，三个生产选择hunks已于release后原子接入。专属runner3478/5508/9708已syntax通过，未开Chrome；原子接线与必要模块/类型检查已通过，唯一首次已正常执行并全清GPU。

合法入口为原m005 MapID0020“阴森魔王路”，PlayerMin4/PlayerMax12；其余原模式无该图，专属runner只选择正式mode5，不注册新许可。真实GLB190模式/几何不变/材质restore/晚load/clear模块PASS，类型单次检查出口0；主线统一terrain20-tank-shop-buy-parameters-production-web-build.log类型/构建出口0(2m2)，发行同步；不再重复工程检查。
