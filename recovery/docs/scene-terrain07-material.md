# Map7 原地形顶点着色

原0007.POL有30mesh、56分片：FVF21，33kind0/23kind1。发布GLB27153展开顶点的UV/packedRGBA逐源值一致，198个展开顶点为非白色，原材质纹理齐。正式ScenePreview已沿SceneTerrainMaterial消费texture×packedDiffuse，保留原顶点着色。

独立 `export_scene_terrain07_material.py` 按原mesh/kind发布56材质资格。ScenePreview与SceneTerrainMaterial共用hasSceneTerrainMaterial，当前资格覆盖0001..0025及FIELD_ROAD_HD，0007正式加载scene-terrain-material-0007.json。消费者复用geom_c1/geom_t_c1 selector及Attach执行，透明门禁GREATER100/混合、LESS/write及清理沿已有合同。

开发归属为独立export/source/docs/runner；共享仅export_scenes独立import/call、SceneTerrainMaterial与ScenePreview追加0007资格。原Crush07/ground/破坏和声音业务保持当前正式消费者。正常mode4/map7选图建房加入→出生附近W/A→真实draw/raw及双完整画布→正常Leave，GPU首次窗口在FX118清理之后，不重复旧远route。

## 未完成范围

来源已通过SOURCE_INPUTS_ONLY。三限定共享hunks已原子接入；真实GLB模块PASS56模式/几何/UV/RGBA不变、还原借用材质、shader释放和晚load取消；Webfocusedtypes出口0。首 `browser-scene-terrain07-2026-10-05T03-48-53-521Z.json` PASS：两端正常W/A输入，各实际提交40片(22opaque/18alpha)，292/151次；含原非白plane02/1、plane02/2、object01/0，未见cylinder33/0。两完整1280×720normal已亲看铺砖/圆纹/市场地面/背景叶片透明，双Leave ownerfalse/material0且等待worldnull。进程/临时目录/3477/5507/9707全清并交GPU。有限索引scene-terrain07-material-player-evidence.json待主审；工程待主线统一必要batch。56材质数据覆盖不代表逐分片像素精度，原CW/device过滤/全图与HD保持未完成。
