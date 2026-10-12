# 扩展地图地形材质、动画法线与模型排序

十二图1814个地形分片已接原kind0/1材质，三图五处纹理已采用现存资源并写入GLB。
MV3光照消费动画NORMAL，CVD、破损和Type5模型消费0/−1/−2绘制优先级。
十二图的环境配置按原地图主题采用独立参数。

## 原地形与发布内容

`export_scene_extended_terrain_material.py` 读取每图原POL的mesh/part身份、同名出现序号、FVF21、
kind和首纹理名，发布 `scene-terrain-material-<id>.json`。全量 `export_scenes.py`
使用同一publisher；定向执行只写十二份材质JSON、三份地形GLB、POL转换索引及纹理采用记录。

| 地图 | 分片 | kind1透明分片 |
| --- | ---: | ---: |
| 0001 | 85 | 8 |
| 0003 | 90 | 17 |
| 0008 | 221 | 42 |
| 0009 | 32 | 0 |
| 0012 | 104 | 33 |
| 0013 | 224 | 39 |
| 0015 | 29 | 0 |
| 0016 | 97 | 7 |
| 0019 | 160 | 20 |
| 0023 | 159 | 73 |
| 0024 | 222 | 85 |
| 0025 | 391 | 33 |

kind0使用 `geom_c1.gbf`，kind1使用 `geom_t_c1.gbf`。`ScenePreview` 与
`SceneTerrainMaterial` 共用地图资格入口，覆盖0001–0025及1002。
0012的plane05/0、plane268/0、plane308/0及0025的box2172/0保留各自同名序号，
消费者按GLB源节点顺序的同名集合索引绑定各自材质。
原纹理乘packed diffuse，kind1启用混合和严格大于100/255的alpha-test，
设备状态沿既有default/选中pass合同。地形为unlit，场景雾沿共享shader计算。

0025的 `box2162/3`、`line590/3`、`box2172/3`、`box1820d/49` 四个kind0
首纹理原本为空；metadata保留空字符串，shader采用白色纹理乘项，直接保留顶点色。
非空引用缺失仍会在加载边界失败并清理。

## 纹理采用规则

原引用与可用原文件来自 [texture-gaps-sol.md](texture-gaps-sol.md)。采用如下映射：

| 地图/材质索引 | 原首纹理 | 采用原资源 | 规则 |
| --- | --- | --- | --- |
| 0009/26、30 | 00026.tga | Data/map/0015/00026.dds | 跨目录同名 |
| 0016/33 | ct-01-1.tga | Data/map/0016/di2.dds | 同图相邻岩壁纹理 |
| 0023/32、134 | qiao.TGA | Data/map/0006/qiao.dds | 跨目录同名 |

采用现存PNG并内嵌至地形GLB，不改原材质名、坐标、UV、顶点色或几何。
每个被替换材质的extras和 `scene-terrain-texture-adoptions.json` 保存引用、采用文件和规则。
`convert_pol.py` 的精确地图/引用映射使重新转换保持同一采用纹理；
`pol-conversion.json` 的missingTextures与adoptedTextures同步当前出版内容。
跨目录同名不能证明原搜索路径；ct-01-1的精确原纹理仍未取得。

## MV3动画NORMAL

`convert_mv3.py` 已发布位置与NORMAL morph。`createMv3Material` 声明NORMAL define，
Babylon的 `PrepareDefinesAndAttributesForMorphTargets` 据此启用normal morph，
顶点shader将 `normalUpdated` 初始化为首帧normal并沿同一morph权重插值。
插值后的法线经world变换和既有归一化规则进入 `sceneLight`，与位置动画保持同步。
没有NORMAL target的模型仍使用自身基础法线；无selected light的查看器保持ambient-only颜色。

## 动态模型排序

`EffectModelRenderer.draw()` 读取 `EffectModelDraw.priority`，每次提交写入
`sceneModelPriority` 与反向 `alphaIndex`。Type5透明时为−2，破损模型为−1，
普通CVD和不透明Type5为0。`SceneCvdAnimation` 保留这组metadata。

`EffectModelMesh` 与静态模型使用同一group0深度及排序接口：不透明/alpha-test按priority降序，
同priority近到远；透明按反向alphaIndex优先级和Babylon远到近排序。
`EffectRuntime` 不再逐帧按实例顺序覆写模型alphaIndex；sprite/particle的group1顺序
和group2屏幕overlay保持现消费者。

## 十二图环境采用值

地图主题取原gamestring ID629+mapId；原fog/sectionLight producer尚未取得。
环境值由 `apps/shared/maps/scene-environment.ts` 的EXTENDED_ENVIRONMENTS提供，
resolution为reconstructed。远端日光采用 `[3000,6000,2000]` 和常衰减，
所有地图沿用设备基线的关闭雾状态，fogMode为0，雾色与雾参数均为0。

| 地图/原名称 | ambient | 雾 | 灯 |
| --- | --- | --- | --- |
| 0001 不毛岛 | 0.48/0.44/0.36 | 关闭 | 暖日光 |
| 0003 蛋糕南路 | 0.43/0.40/0.38 | 关闭 | 暖日光 |
| 0008 废弃魔王路 | 0.32/0.34/0.38 | 关闭 | 冷日光 |
| 0009 秘密工厂迷宫 | 0.50/0.52/0.54 | 关闭 | 两条冷暖工厂灯 |
| 0012 不是约翰的路田园 | 0.40/0.45/0.38 | 关闭 | 田园日光 |
| 0013 凄凉魔王路 | 0.30/0.32/0.37 | 关闭 | 冷日光 |
| 0015 秘密工厂仓库 | 0.52/0.50/0.46 | 关闭 | 一条暖仓库灯 |
| 0016 仙剑岛秘密仙境 | 0.38/0.44/0.42 | 关闭 | 青绿日光 |
| 0019 田野路南瓜大丰收 | 0.46/0.40/0.32 | 关闭 | 秋色日光 |
| 0023 春节版仙剑岛 | 0.45/0.40/0.38 | 关闭 | 暖日光 |
| 0024 圣诞节版魔王山 | 0.38/0.42/0.50 | 关闭 | 冷日光 |
| 0025 情人节版早安公园 | 0.46/0.40/0.43 | 关闭 | 暖日光 |

原十三图及1002继续使用既有户外provider。切图仍由ScenePreview在加载shader前绑定环境，
clear/reset清掉前图fog/ambient；所有材质读取当前场景接口。

## 验收边界

整批完成一次集中静态走查。定向publisher已执行，1814个材质记录、三图五处内嵌纹理及采用清单已实际发布。
未运行测试、浏览器、构建、类型检查或原生取证。普通整图加载、混合交叠、
动画光照、双端/高清、长时释放与原GPU/像素等价仍待实测。
M3-06-EXT-RENDER和MAP-EXT-*完整父项保持未勾。
