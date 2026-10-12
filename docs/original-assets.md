# 运行美术资源

界面由 SVG、HTML、CSS 与独立图片共同绘制。保留的图标、文字、数字、表情、人物肖像、加载背景、标志与光标按各自的图片 URL 发布。动态正文使用附件字体，数字字体保留图片 glyph。

高清素材覆盖 3D 模型贴图、minimap 与保留图片的界面元素，包括战车、宠物、地图、场景物件、模型特效、可选皮肤、材质动画帧、小地图底图及小地图标记。模型几何、UV 与动画沿用原资源。

## 美术目录

| 目录 | 内容 |
| --- | --- |
| `art/original/` | 高清化之前的原始导出图片与模型，保留原尺寸和文件内容 |
| `art/hd/` | 清理后的完整运行资源快照，包含最新图片、模型、音频与资源清单 |
| `art/hd/manifest.json` | 模型贴图的原图、高清图路径及模型清单 |
| `art/hd/tank-track-animations.json` | 坦克履带动画帧、帧间隔及颜色滤镜 |
| `art/hd/field-road.json` | 田野路地图模型与贴图清单 |

两份图片按运行资源相对路径保存；原本位于源码目录的图片使用 `local-images/` 前缀。`recovery/output/verified/assets/data` 保存客户端解包来源。

## 发布

```sh
npm run assets:original
npm run assets:hd
```

`assets:original` 发布原版 UI 单图，并覆盖安装高清模型贴图与 minimap，清理无引用的运行图片。`assets:hd` 同时将高清贴图安装到模型材质，随后执行同一套图片发布流程。`assets:rebuild -- --reuse-verified` 重新导出资源后安装这两份美术资产。

运行图片以独立文件发布到 `apps/web/public/`，本地图片位于其 `local-images/` 子目录。Vite 扫描实际文件生成 `image-assets.json`，界面、Canvas 和模型加载器通过各自的图片 URL 使用同一缓存。

美术目录和运行资源由 Git 忽略。资源包包含 `apps/web/public/` 与 `apps/server/resources/`（数据表、场景和碰撞数据）；Docker 资源镜像通过 `deployment/import-assets.sh` 从本地运行资源创建。

## 发布限制

GitHub v1.0.0 已发布资源包仍使用精灵图，需要替换为当前单图资源后再用于本版本。安装器在解压前识别该格式并停止，保留现有本地资源。单图资源包可通过 `npm run assets:install -- --archive /path/to/cdtank-assets.tar.xz` 安装。
