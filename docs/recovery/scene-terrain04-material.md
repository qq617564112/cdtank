# Map04 原地形材质

原m001/m003表的0004“早安一路”合法，最低4人、最多10人。本片恢复出生附近有纹理地形材质；旧Breach04目标479两次路线缺口保持不变。

原0004.POL有56mesh、150分片，127kind0/23kind1，全部FVF21。四个分片box2162/3、line589/3、line590/3、box2172/3原纹理为空，fixed-function null-texture合同不足，全部列入withheldParts。独立export_scene_terrain04_material.py仅发布其余146有纹理分片（123opaque/23alpha）到scene-terrain-material-0004.json，不造白纹理或替代原空材质。

scene-terrain04-material-source.json/log记录PASS_TEXTURED_SOURCE_INPUTS_WITH_WITHHELD_GAPS：GLB44298展开顶点的UV与packedRGBA逐原值匹配，其中4233非白顶点；146有纹理消费者材质factor逐源一致。空纹理line589/3与line590/3原factor为白，发布PBR为(.4666667,.4666667,.4666667,1)，差异保存在withheldMaterialFactorMismatches，sourceMaterialFactorsExact为false。原首factor断言FAIL保存在scene-terrain04-material-source-first.log，不将来源有限通过当150完整材质恢复。

接线边界为export_scenes独立hook、SceneTerrainMaterial的0004资格、ScenePreview地形材质分支0004。普通玩家限定mode1四认证Account出生W/A与实际道路/地形画布、正常Leave等待worldnull后的材质清理，不复跑479破坏路线。

## 未完成范围

独立原数据和来源检查已收齐；真实GLB模块已准备146分片、123opaque/23alpha及四withheld材质引用保持断言。专属browser-scene-terrain04-material.mjs以3497/5527/9727准备正常mode1四帐号出生W/A入口，语法检查通过。三个共享hunk已具名协调并原子接入，仅增加0004地形资格与独立export hook。scene-terrain04-material-module.json/log为PASS_MODULE_ONLY：真实GLB146消费者（123opaque/23alpha）正确选择，四withheld分片保持原材质引用；全部geometry/UV/color保持、借用材质还原、shader释放与晚加载取消通过。scene-terrain04-focused-types.log实际Web tsc出口0，生产已稳定待统一必要工程批次；普通mode1四认证帐号首验browser-scene-terrain04-2026-10-05T05-22-13-840Z.json为PASS：双W/A移动98.994/96单位，yaw分别+.240/+.192；实际103/111分片（86/93opaque、17/18alpha），851/440实draw。双完整1280×720自然画布已亲看原灰石路、红棕环形地面、紫砖花坛金边、粉白花草裁切、叶林围栏及远处屋顶标牌，近坦克/花坛/guest门柱自然遮挡。普通双Leave等待worldnull后ownerfalse/material0，finally同值，3497/5527/9727进程与临时目录全清。scene-terrain04-material-player-evidence.json汇总此有限范围，待root主审与统一工程出口。四空纹理/null-texture表现、两发布factor差异、150全部像素、原GPU/CW/过滤精度、高清及整图父保持开放。

统一工程terrain17-04-ammo18-19-room-intimate-production-web-build.log为主线实际Web类型/发行构建出口0（1m42），release已同步；本片复用工程结果。
