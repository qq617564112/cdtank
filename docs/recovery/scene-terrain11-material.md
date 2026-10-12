# Map11 原地形材质消费者

合法mode1/map11原0011.POL含35mesh、118分片：FVF21，93kind0与25kind1。发布GLB34479展开顶点的UV/packedRGBA逐源值一致，RGBA均白，原材质纹理无缺失。复用terrain02已执行的FVF21/kind0→geom_c1、kind1→geom_t_c1选择与完整Attach来源，不重复native。

独立 `export_scene_terrain11_material.py` 发布118原mesh名/kind/shader。正式 `SceneTerrainMaterial.load('0011', terrain)` 与ScenePreview仅增加0011资格；owner/load取消/clear沿已验2/18合同。材质恢复texture×packedDiffuse、LESS/write，kind1原GREATER100透明门禁与混合，借用原纹理且释放时还原材质，不改几何、放置、灯光或General11消费者。

`tests/scene-terrain02-material-source.py 11` 为PASS_SOURCE_INPUTS_ONLY，`tests/scene-terrain02-material.mts 11` 为PASS_MODULE_ONLY：118原材质、93/25模式、position/color/UV不变、还原借用材质、shader释放与晚load取消。两者不证明实际GPU或玩家画面。

首次实际使用专属 `browser-scene-terrain11-material.mjs`，正常React选mode1/map11→建房加入四普通认证玩家→正常出生附近W/A→真实onBeforeDraw的原材质/世界矩阵/纹理及双完整画布→普通Leave读取ownerfalse/material0。未注入位置、相机或事件，不逐118分片扩验；GPU窗口先FX13503，清理后顺序执行。

## 未完成范围

首次raw `browser-scene-terrain11-2026-10-05T03-36-52-792Z.json` PASS：两端普通W/A移动，原opaque/alpha真实提交分别59片(48/11)、58片(46/12)，516/226次。两完整1280×720natural已亲看夜景原道路与路缘纹理/背景树木，双Leave ownerfalse/material0且先等待worldnull；进程/临时目录及3476/5506/9706全清。索引 `scene-terrain11-material-player-evidence.json` 主线已亲审四完整PNG接受有限可见/Leave范围，夜景整体暗色按实际记录；工程复用focusedtypes并待root下一统一batch。原CW/GPU过滤精度/完整高清及整地图父项开放；透明分片仅有module模式证据，实际见到哪些材质按raw记录，不以118数据覆盖冒逐片像素通过。
