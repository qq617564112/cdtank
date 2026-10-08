# 图片精灵图

运行图片以 PNG 精灵图与独立大图发布，实际数量由 `art/hd-assets/sprite-packing.json` 记录。UI 格子来自原始客户端图片，模型格子保留高清贴图，小地图底图保留涂鸦手绘风。

精灵图最大尺寸为 4096×4096，按地图、坦克、UI 和颜色配置分组。保留图片尺寸、透明通道和颜色配置，不旋转格子。打包器按完整 RGBA 通道核对每个格子，包括全透明位置的 RGB；像素与颜色配置相同的图片共用一个格子。

`recovery/output/web-assets/sprite-images.json` 保存原图片路径、精灵图路径及整数区域坐标。本地图片引用使用 `/local-images/` 路径；业务资源目录保留原图片名称。启动只下载、缓存和解码整张精灵图及独立图片，进度数量按实际图片文件计算。

增减图片后重新打包并发布资源目录与 `sprite-images.json` 即可。Vite 自动扫描目录生成 `image-assets.json`，加载数量和进度自动计算，无需修改 loading 代码。

UI 背景通过背景尺寸和位置显示对应格子；加载页、缩略图和战斗提示通过 SVG 视口显示区域，平铺进度条使用 SVG pattern。聊天动画只切换区域坐标。Canvas 使用共享解码图集及 `drawImage` 的源区域参数，UI 小图不再生成独立 PNG Blob 或逐张解码。

模型在实际请求贴图时裁出原尺寸 PNG，GLB 外部图片通过 `preprocessUrlAsync` 读取共享缓存，直接创建的 Babylon 纹理通过图片加载入口读取。模型 UV、重复平铺及滚动采样继续使用独立纹理。鼠标光标也保留独立图片，因为 CSS cursor 不支持图集区域。并行裁切结束后释放临时 ImageBitmap；重复格子共享已有 Blob URL。

原运行图片保存在 `art/hd-assets/sprite-originals`，`manifest.json` 记录原路径。备份位于发布目录之外。

重新打包：

```sh
npm run assets:sprites
python3 scripts/preview-image-sprites.py
```

`assets:hd` 仅安装模型高清贴图，随后恢复非模型原图、清理无引用图片并重新打包。重新导出缩略图、小地图或原始资源后，执行 `npm run assets:clean-images` 完成清理、共享重复格子和目录更新。

恢复独立原文件：

```sh
python3 scripts/pack-image-sprites.py --restore
```

恢复后原路径与精灵图路径仍可用。再次运行打包命令可将原图片移回备份目录。

`art/hd-assets/sprite-preview.html` 支持筛选、缩放及查看每个格子的原图片路径。统计在 `sprite-packing.json`，当前资源路径核对在 `image-cleanup-inspection.json`。清理范围及备份说明见 `docs/image-asset-cleanup.md`。

## 验证范围

精灵图文件像素、裁切区域、原文件备份及资源路径映射沿用现有核对记录。直接使用图集区域的加载与绘制改动已完成集中代码走查，按照仓库协作要求未运行测试、构建、类型检查或浏览器验收。
