# 扩展地图资源、动画实例与独立水面

默认 `recovery/output/web-assets` 已发布八图 Plant、0023 Castle、05416 材质及
0003/0016 水面 metadata。五条 General 的 CVD 绑定已写入 `scene-placements.json`，
全量 producer 保持相同绑定。正常入口复用既有场景、摆动和动画碰撞消费者。

## 原资源与发布内容

| 地图 | Plant 数量 | 型号 |
| --- | --- | --- |
| 0003 | 52 | 05413 |
| 0008 | 82 | 05416 |
| 0012 | 28 | 05413 |
| 0016 | 107 | 05401/05403/05405/05413 |
| 0019 | 32 | 05413 |
| 0023 | 73 | 05401/05403/05405/05413 |
| 0024 | 110 | 05401/05403/05405/05413 |
| 0025 | 34 | 05413 |

518 条 Plant metadata 使用本图原 OBJ 身份、enabled 和 POL 高度/边界。
放置位置及旋转仍由 `scene-placements.json` 的原矩阵提供，0025 的旋转植物使用同一消费者。
公共 `scene-plant-material-05413.json` 包含五种原材质，05416 的具名 POL 材质用于
0008 的82株。`ScenePlantSway` 按局时钟摆动，并沿既有快照/root 处理隐藏与新局恢复。

0023 的 Castle81/05449、82/05450 metadata 读取本图 CAS 和各自原 INI，
每座发布 `c1/c2/c3/n1/n2` 五动作的 duration、tracks、tags、sourceBounds 与 GLB 引用。
十个动作均已有实际 GLB。Web 动作消费者和 server 初始/动态碰撞共用本图库。

| General placement | 原模型 | 已发布动画库 |
| --- | --- | --- |
| 0003/146 | obj05015 | scene-animation-0010.json |
| 0009/111、112 | obj05018 | scene-animation-0018.json |
| 0015/103、108 | obj05018 | scene-animation-0018.json |

这五条原 enabled1 记录使用各自 `Data/scnobj/<model>/<model>.CVD`，不增加静态替代模型。
`SceneCvdAnimation` 复用原节点、顶点及纹理；server 的 `getSceneSolids`、
`getAnimatedSceneColliders` 和既有动态同步消费同一 `animation.library/reference`，
按共同局时钟更新射击三角面与 NAV 占用。三图 `resolved` 包含新增动画实例。

## 水面合同

0003 和0016各有原 `water.POL` 与 `waves.POL`，已发布 GLB 均保留各自坐标和内嵌原纹理。
`scene-water-0003/0016.json` 引用两层几何、原 opacity/bounds 和共用32张 CAUST PNG。
定向发布复用既有纹理，完整 `export_scene_water02.export()` 同时发布0002/0003/0016及32帧。

原公共 loader462f24读取本地图 water/waves，update462d14及draw462dc6的已保存合同
见 [scene-water-0002.md](scene-water-0002.md)。两图 `_water`、`_waves` 的 FVF21/kind1
与该消费者相同，采用同一材质状态、降序 priority、water V 偏移和 waves 纹理替换。
water UV 按 delta×0.05 累加，超过64减64；waves 按 wall timer 严格超过 f32(0.05)
推进一帧，不追赶跳帧。Web wall timer 使用 `performance.now()`。

`ScenePreview` 普通入口加载两图水面，失败清理当前场景，晚完成加载释放旧 owner。
`SceneWater` 独立推进 water UV 与 waves 帧，正常 clear/dispose 释放容器和32张纹理。
0016/328 WaterFall 保持独立消费者，水面无需快照或命中事件启动。

## 验收边界

资源 publisher 已执行，metadata 已实际产出；整批完成一次集中静态走查。
未运行测试、构建、类型检查、浏览器或新的 native 取证。
普通页面加载、动画碰撞对局、双端局时钟、长时释放、原 GPU/像素等价与高清表现仍待实测。
M3-08-EXT-PUBLISH、MAP-EXT-* 和 M3/M4/M7 完整父项保持未勾。
