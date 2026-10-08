# 图片精灵图

4,859 个运行图片路径共用 4,186 个格子，合并为 141 张 PNG 精灵图。发布目录共有 158 份图片：141 张精灵图、15 张独立大图、一张 SVG 地图预览和一个 ICO 图标。

精灵图最大尺寸为 4096×4096，按地图、坦克、UI 和颜色配置分组。保持原尺寸、透明通道和颜色配置，不旋转格子。4,186 个独立格子写入后与原图逐 RGBA 通道比较，像素一致，包括全透明位置的 RGB。尺寸、RGBA 像素和颜色配置相同的图片共用一个格子。

`recovery/output/web-assets/sprite-images.json` 保存原图片路径、精灵图路径及整数裁切区域。本地图片引用使用 `/local-images/` 路径；业务资源目录及 GLB 的原图片 URI 由统一缓存解析。图片入口下载和缓存整张精灵图，再裁出原尺寸的 PNG Blob URL，供 UI、Canvas 和 Babylon 使用。重复格子共享 Blob URL 和解码结果。

预加载按精灵图逐张裁切，每张结束后释放临时 ImageBitmap；精灵图本身不再作为 UI 图片长期解码。模型继续使用独立纹理，UV、平铺和动画采样方式保持原样。合并减少发布图片和网络请求数量，GPU 纹理与绘制次数保持现有方式。

原运行图片保存在 `art/hd-assets/sprite-originals`，`manifest.json` 记录原路径。备份位于发布目录之外。

重新打包：

```sh
npm run assets:sprites
python3 scripts/preview-image-sprites.py
```

安装高清资源时，若已存在精灵图目录，`assets:hd` 会在安装结束后清理无引用图片并重新打包。重新导出缩略图、小地图或原始资源后，执行 `npm run assets:clean-images` 完成清理、共享重复格子和目录更新。

恢复独立原文件：

```sh
python3 scripts/pack-image-sprites.py --restore
```

恢复后原路径与精灵图路径仍可用。再次运行打包命令可将原图片移回备份目录。

`art/hd-assets/sprite-preview.html` 支持筛选、缩放及查看每个格子的原图片路径。统计在 `sprite-packing.json`，当前资源路径核对在 `image-cleanup-inspection.json`。清理范围及备份说明见 `docs/image-asset-cleanup.md`。

## 验证范围

已核对精灵图文件像素、裁切区域、原文件备份及资源路径映射。按照仓库协作要求，未运行测试、构建、类型检查或浏览器验收。

参考角色预览页原有的独立参考图片 `nanobanana-preview-original-2026-10-07T03-03-04-732Z.png` 在工作区缺失；该图片不在精灵图合并范围内，记录在资源核对报告中。
