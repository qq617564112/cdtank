# 0002 原地形材质消费者

M3-06：map2原地形的76个片段具有两种实际材质选择。原1001206d→10012164对0002.POL每个mesh名称、FVF21、material kind执行，58个kind0得0x801、18个kind1得0x881。原1002727f/10027290注册分别指向geom_c1.gbf/geom_t_c1.gbf。

二者Lighting=FALSE、Color/Alpha Modulate(TEXTURE,CURRENT)、UV WRAP。geom_t_c1另开AlphaTest GREATER100和AlphaBlend；geom_c1沿默认AlphaTest/AlphaBlend关闭。default.gbf规定SRCALPHA/INVSRCALPHA、LESS、depth write。现发布地形GLB的76材质均为PBR MASK/alphaCutoff .1；SceneRuntime提供半球光，尚未消费原地形固定函数色彩与两种alpha选择。

地图线拥有export_scene_terrain02_material.py、scene-terrain-material.ts、专属native/source/module和本doc。主线已授权并接export_scenes独立import/call与ScenePreview仅terrainMaterial owner/load/clear；load失败清理、revision晚load取消复用原边界。原geometry/texture/UV、water/Crush/Plant及服务器规则保持。

## 来源与模块

- scene-terrain02-material-native.json/log：原selector执行全部76原part，实际flags与具名注册字符串；不称GPU运行。
- scene-terrain02-material-source.json/log：原POL packed BGRA→GLB COLOR_0、原UV，26727展开顶点完全一致；57顶点非白RGB，原材质baseColorFactor全部白。原shader/default全文保存。
- scene-terrain02-material-module.json/log：真实发布GLB载入，独立SceneTerrainMaterial更换76材质，58opaque/18alphaTest+blend，depth write/LESS；geometry/COLOR_0/UV不改，dispose恢复原borrowed materials且释放shader，lateLoad取消。NullEngine不证明GPU编译或像素。

消费者直接采原texture与packedDiffuse相乘，不受PBR灯光/金属度/roughness影响。kind1结果alpha<=100/255丢弃，kind0保持原opaque。纹理由原地形容器拥有，本owner不重复释放borrowed texture。

## 正式验收范围

实际仅合法mode1/map2普通React选择/建房/加入/Ready，出生附近普通W/转向自然观察原草地或道路的无额外光照材质，实际完整画面、原纹理及几何保持，正常Leave释放。无远目标路线、旧waterbank/Plant327route或跨图等待；不注入位置、相机、通知、胜负。

首browser-scene-terrain02-2026-10-05T02-09-52-154Z.json PASS：两React和两正常认证辅助玩家完成普通选图/建房加入Ready。主端W/A从(-1779.89,525.64)到(-1767.2,367.15)，客端从(-1298.55,498.5)到(-1283.13,322.17)；各42/52源片段实际onBeforeDraw，opaque计136/84、alphaTest计42/20。两natural及两完整actual PNG亲审：主道路/草地、客草地及背景树/天空可辨，未见该视图地形消失或白材质块。蓝道路纹样属于原lu纹理，不作水动画证据。双正常Leave ownerfalse/materials0，3383/5433/9633服务/Chromium关闭、temp移除。有限证据索引scene-terrain02-material-player-evidence.json。

## 未完成范围

正式hook与新Web类型检查已通过；首次普通玩家可见/双端实绘/Leave已交，统一发行待下一必要主线batch。模块保持现导入double-sided几何；原default CullMode CW与Web反射空间的精确对应未恢复。原D3D滤波、混合alpha目标通道、GPU精度及全部地图材质父项未验收。本片不作完整材质或整图PASS。
