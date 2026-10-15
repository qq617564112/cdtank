# 运行美术资源

界面由 SVG、HTML、CSS 与图片共同绘制。图标、艺术字、数字、表情、人物肖像、加载背景、标志与光标通过原资源路径查询 UI 精灵图或独立图片。动态正文使用附件字体，原来源数字和文字 glyph 保留图片字形。

高清素材覆盖 3D 模型贴图、minimap 与保留图片的界面元素，包括战车、宠物、地图、场景物件、模型特效、可选皮肤、材质动画帧、小地图底图及小地图标记。模型几何、UV 与动画沿用原资源。

## 美术目录

| 目录 | 内容 |
| --- | --- |
| `art/original/` | 高清化之前的原始导出图片与模型，保留原尺寸和文件内容 |
| `art/hd/` | 高清源图与资源快照，包含最新图片、模型、音频与资源清单 |
| `scripts/asset_compression/recipe.json` | 逐图源路径、尺寸依据、输出路径和编码方案 |
| `art/compressed/` | 按配方生成的运行成品及报告 |
| `apps/web/public/` | 发布目录：独立资源、UI 图集及怀旧／HD 两套战斗素材 |
| `apps/server/resources/` | 内容表、场景与预烘焙碰撞数据 |
| `art/hd/manifest.json` | 模型贴图的原图、高清图路径及模型清单 |
| `art/hd/tank-track-animations.json` | 坦克履带动画帧、帧间隔及颜色滤镜 |

源素材按配方使用的逻辑资源相对路径保存。早期源码图片使用 `local-images/` 标识；进入压缩配方的源码缩略图、印章和图标使用 `bundled-ui/`。public 的实际文件统一归入 `assets/`、`data/`、`manifests/`，详见[public 资源目录](public-assets.md)。`recovery/output/verified/assets/data` 保存客户端解包来源。

## 当前发布流程

新增和更新先写 HD 源图，再更新配方，生成压缩成品并发布。每次从源图编码，保留 `art/original/` 和 HD 原文件。

```bash
npm run assets:compressed
npm run assets:sprites
npm run assets:battle-artwork
```

| 输出 | 用途 |
| --- | --- |
| `assets/ui/atlases/`、`assets/ui/images/` | UI 图集与独立大图 |
| `assets/textures/original/`、`assets/models/original/` | 原尺寸无损战斗图片与对应模型，移动端共用 |
| `assets/textures/hd/`、`assets/models/hd/` | 使用压缩成品的战斗图片与对应模型 |
| `manifests/sprite-images.json` | UI 图片区域与资源标识映射 |
| `manifests/battle-artwork.json` | 怀旧与 HD 两套战斗资源 URL、来源和共用素材 |

其它独立贴图使用 `npm run assets:publish -- --image <compressed中的相对路径>` 发布。精灵图与战斗素材生成后自动归档；音频、字体、数据表和碰撞数据由资源安装或原客户端导出流程准备。`npm run assets:publish` 也可整理已有 public 文件，更新 JSON 和 GLB 外部引用，不重新编码图片。

更新一张独立图片时使用增量入口，例如：

```bash
npm run assets:compressed -- --image ui/lobby/welcome-banner.webp
npm run assets:sprites
```

`--image` 可重复指定源路径或输出路径；模型内嵌图片及 JSON 引用更新使用完整生成。配方、最终尺寸、编码方案和体积报告见[资产压缩与精灵图](asset-compression.md)。

Vite 扫描实际资源生成 `manifests/image-assets.json`；界面、Canvas 和模型加载器共用缓存。生产发布需要同步新的前端构建与清单，见[资源加载](resource-loading.md)。

## 原素材恢复与重新导出

`npm run assets:original` 从 original 发布图片，再覆盖 HD 目录的现有图片，发布履带配置、清理无引用图片，移除已有 UI 图集与精灵图清单，并整理目录。`npm run assets:hd` 还会将高清材质安装到原始模型；这两个入口用于原来源单图恢复和素材维护，恢复后需生成当前 UI 及怀旧／HD 两套战斗资源。

`npm run assets:rebuild -- --reuse-verified` 重新导出模型、表和其它资源，再安装本地美术素材。需要原客户端及完整提取目录，步骤见[资源重建](recovery/reproducible-assets.md)。恢复或重建后，按当前发布流程重新生成压缩成品、UI 精灵图和怀旧／HD 两套战斗素材。

## 打包与部署

美术目录和运行资源由 Git 忽略。1.0.1 及以后 GitHub Release 将完整 `apps/web/public/` 发布为资产包，服务端 `apps/server/resources/` 随程序包保存在 `content/`；程序和资产共用版本。HD 创作源图、原版档案和压缩配方分别保存。Docker 资源镜像仍由 `deployment/import-assets.sh` 从本地完整运行目录创建，发布步骤见[自动部署](../deployment/forgejo.md)。

## 安装运行资源

解压程序包后执行 `node install.mjs`，自动下载同版本资产、安装依赖并启动。源码工作区执行 `npm run assets:install`，从两个附件安装 public 与服务端资源；本地附件分别通过 `--archive` 和 `--program` 指定，见[GitHub 发布与安装](github-publication.md)。

包内保留 `manifests/ui.json`、`sprite-images.json`、`battle-artwork.json`、UI 图集、怀旧与 HD 两套战斗资源、字体许可和现成碰撞数据。直接安装不重新生成素材；素材编辑需要另行保留完整 `art/` 源目录。
