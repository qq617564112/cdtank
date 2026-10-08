# 全地图三维俯视小地图

0001–0025 与测试地图1001共26张地图使用实际三维场景重新渲染为1024×1024 PNG。正式战斗雷达按mapId读取这些底图，保留原有本机居中、随相机转向的采样，以及玩家、王和目标的动态标记。

图片位于 `apps/web/src/assets/maps/minimaps/`，索引 `index.ts` 使用 `new URL(..., import.meta.url)` 随前端发布。启动图片预加载器通过现有源码图片glob下载并解码这些资源。资源安装不会覆盖源码中的PNG。

## 批量生成

准备项目依赖和 `recovery/output/web-assets/` 后，在仓库根目录执行：

```sh
node scripts/render-map-minimaps.mjs
```

脚本读取 `scene-placements.json` 的全部地图，自行启动独立Vite渲染页面和无头Chromium，不需要游戏服务器或账户。浏览器可用 `CDTANK_CHROME` 指定；资源目录可用 `CDTANK_WEB_ASSETS` 指定。结束后关闭本次渲染器并清理临时目录。

每次更新全部PNG及源码索引；总览输出为 `recovery/output/map-minimaps-overview.png`。

## 渲染与坐标

- 复用正式战斗的 `ScenePreview.load(id, effects)`，加载地形、放置物、植物、水面、原CVD首帧和完整城堡n1动作。材质、模型、变换及光照与当前战斗场景一致。
- 捕获只使用 `ScenePreview.minimapMeshes` 中已启用的几何体，不烘焙玩家、弹丸、伤害数字、技能或破损特效。场景保持初始状态。
- 室内地图0009、0015、0018排除覆盖整个战场的天花板primitive（`plane02/1`、`plane01/23`、`plane01/19`），显示下方真实地面与物件；其它建筑屋顶保留。
- `BattleMinimap` 用于离线捕获，采用1024×1024渲染目标和4倍多重采样。相机位于最高物件上方，沿负Y轴正交俯视。
- 相机与标记共用 `hudMinimapBounds`，按每张地图NAV/RPT并集的正方形范围取景；1001使用1248×1248世界单位的测试地图范围。
- GPU读取翻转行并反射X，恢复原世界坐标，最终+X向右、+Z向上。像素映射为 `u=(x-minX)/(maxX-minX)`、`v=(maxZ-z)/(maxZ-minZ)`，与雷达着色器一致。
- 进入战斗直接加载对应PNG，离房释放雷达纹理；不再在每次战斗加载时重新捕获场景。

已完成26张底图生成和静态图像查看。完整战斗HUD与真实对局验收保持开放。

## 限制

底图反映当前已恢复的真实三维场景；原场景中尚未恢复模型的记录仍沿现有加载器处理。未运行测试、构建、类型检查或游戏浏览器验收。
