# Map22 原地形材质

原m005表中的0022“魔王山宝藏”仅合法mode5，最低4人、最多12人。正式MAPS由原五张模式表读取；本片保持该资格，不注册其他模式。

原0022.POL有36mesh、72分片，46kind0/26kind1，全部FVF21且有原纹理。独立export_scene_terrain22_material.py发布72个原mesh/kind/shader选择到scene-terrain-material-0022.json；kind0对应geom_c1，kind1对应geom_t_c1，复用既有具名原shader合同。

scene-terrain22-material-source.json与同名log记录PASS_SOURCE_INPUTS_ONLY：发布GLB9840展开顶点的UV、packedRGBA与原POL逐值一致，1791非白顶点，原材质factor逐源保留。本来源检查不证明实际GPU或玩家画面。

文件归属为独立export/source/library/docs；共享拟限定export_scenes独立import/call、SceneTerrainMaterial的0022资格、ScenePreview的0022 terrain分支。正常玩家范围为mode5四人选择/建房加入、出生附近W/A真实移动或转向、有限原材质实际draw及完整双画布、普通Leave等待世界null后的owner/材质释放。木桶破坏、声音、服务器许可与主生命周期沿既有消费者。

## 未完成范围

正式SceneTerrainMaterial与ScenePreview已追加0022资格，export_scenes追加独立hook。scene-terrain22-material-module.json/log为PASS_MODULE_ONLY：真实GLB72分片（46opaque/26alpha）的材质选择、geometry/UV/color保持、借用材质还原、shader释放及晚加载取消通过；scene-terrain22-focused-types.log实际tsc出口0。工程复用主线terrain22-ammo2013-home-resource-production-web-build.log types/build实际出口0、Vite1m46，dist/release已同步；未独立重复构建。

专属browser-scene-terrain22-material.mjs使用3483/5513/9713，复用普通W/A与真实turn取证门禁；普通Leave等待世界null再采owner和材质计数。72逐片像素、原GPU/CW/过滤精度、高清与整地图父项保持开放。

## 普通玩家有限交付

scene-terrain22-material-player-evidence.json索引唯一首04-24-54-464Z raw PASS。正常React mode5/map22选图、双网页建房加入、两普通认证辅助Ready，共四人按原资格入场；主端W/A实际移动96单位且转向0.192rad，客端移动93.0043单位且转向0.192rad。双端实际提交48/49分片（34/34 opaque、14/15 alpha），552/282 draw；均有15个源非白顶点分片提交，不当独立像素贡献证明。

地图线亲看两张1280×720完整natural画布：原绿色地面、浅色积雪坡面、地面纹样与树/森林alpha轮廓清楚；近处坡面自然遮挡远地形。范围是原静态地形材质，不证明雪花动画、声音、木桶破坏或新增碰撞许可。

普通源Leave等待世界null后双端ownerfalse/material0，finally相同；process-cleanup PASS，3483/5513/9713无监听，Chrome/server/temp释放。GPU已直接交UI，不重复本片路线。主线亲看双完整图，mainReview为ACCEPTED_MAP22_TEXTURED_TERRAIN_NORMAL_INPUT_LEAVE，并原位登记M3-06有限范围；父项保持开放。
