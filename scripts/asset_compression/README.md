# 高清资产压缩

从 `art/hd` 生成 `art/compressed`。入口与配方位于 `scripts`，空输出目录也能生成完整资产，不读取已有压缩图片、历史报告、`art/original` 或应用源码。

仓库根目录执行：

```bash
python3 scripts/generate-compressed-assets.py
```

依赖 Python 3.10+、Pillow、NumPy 和 libwebp 的 `cwebp`。当前资产采用 libwebp 1.2.4；同版本可减少编码结果的差异。安装 Python 依赖：

```bash
python3 -m pip install -r scripts/asset_compression/requirements.txt
```

Debian/Ubuntu 的 `cwebp` 由 `webp` 软件包提供：

```bash
sudo apt-get install webp
```

`cwebp` 默认从 PATH 查找，也可显式指定：

```bash
python3 scripts/generate-compressed-assets.py --cwebp /path/to/cwebp
```

可使用 `--source`、`--output`、`--recipe` 和 `--workers`。默认输出沿用 `art/compressed`；如需 `art/compress`，加上 `--output art/compress`。已有输出中的资产会按高清源图重新生成，每次均从源图开始，避免反复有损编码。

`recipe.json` 包含全部 5,018 张图片的源路径、最终尺寸、分类与最终采用的编码方案，以及 35 张内嵌图片和 185 张 UI 旧图替换规则。最终尺寸采用已确认的 UV 面积计算结果，并记录坦克参考密度和计算依据。该配方固定当前资产集；新增图片、调整显示用途或修改源图尺寸时，更新对应条目。

| 素材 | 最终尺寸规则 | 编码 |
| --- | --- | --- |
| 坦克 | 长边 1600 | 不透明贴图 q95 |
| 建筑、树木、地面、水面 | UV 密度需求，长边上限 2048 | 不透明 q95，透明 near80 |
| 环境背景、小地图 | 长边上限 2048 | 背景按透明度分类，小地图保留 |
| 特效 | 显示平面与帧 UV，长边上限 1024 | near80 |
| 履带、宠物、饰品、朝向镜头的植物 | 已确认的模型或单面 UV 需求 | 按分类与透明度编码 |
| UI、字形、缩略图 | 4K 显示用途，原生尺寸 ×4 | near80；SVG、ICO 保留 |

保持宽高比，不放大小图。源图先直接缩放一次到最终尺寸，再生成无损基准和最终编码候选，采用较小文件。q95 使用 `-m 6 -sharp_yuv -alpha_q 100 -alpha_filter best`。near80 先处理不透明 RGB，再恢复原 Alpha、全透明区域 RGB 和纯黑 RGB，必要时用无损 WebP 封装；每张核对最终 RGB 通道差不超过 1/255。无损基准使用 `-lossless -q 75 -m 4 -exact`。原本有损且不改尺寸的 WebP 直接保留。

应用内缩略图和印章的 34 个输入副本位于 `art/hd/bundled-ui`，保留高清源文件；输出为 `bundled-ui` 中的 33 张 WebP 和 1 个 ICO。生成期间的 PNG 仅存在于输出目录下的临时工作目录，完成后删除。

JSON 资源引用、UI 替换和 GLB 外部图片同步改为 WebP。GLB 内嵌图片保留在模型中，使用 `EXT_texture_webp`，非图片缓冲区内容保留。制作预览和已替换旧图不输出，运行目录和应用代码不修改。

结果写入 `reports/generated-assets.md`、`reports/generated-assets.json`、`reports/generated-assets.csv` 和 `reports/runtime-files.json`。体积统计只包含生成的运行资产，不包含历史试压样本、脚本和报告。临时编码文件不计入资产。

当前压缩目录的完整备份位于 `art/compressed-backup-20261012-090113`，包括运行资产、报告和试压样本。源输入和输出路径重叠时，入口拒绝执行。

## 精灵图输出

从压缩目录读取 UI、字形、坦克和宠物缩略图，以及共享战斗状态图标，输出到网页 public 目录：

```bash
python3 scripts/generate-sprite-assets.py
```

也可执行 `npm run assets:sprites`。完整生成顺序为 `npm run assets:compressed`，再执行 `npm run assets:sprites`；只更新精灵图时单独执行后者即可，读取当前压缩成品。

默认输入 `art/compressed`，默认输出 `apps/web/public`；也接受 `CDTANK_WEB_ASSETS` 环境变量。支持 `--source`、`--output`、`--recipe`、`--page-size`、`--cwebp` 和 `--workers`，依赖与压缩脚本相同。

- `public/sprites/*.webp`：按界面用途、原图集区域和战斗数字分组的精灵图，默认最长边不超过 2048，按实际内容尺寸输出。
- `public/sprites/standalone/`：保留原样的全屏背景、放不进图集的大图、SVG、ICO 和只能独占一页的单图。
- `public/sprite-images.json`：图片区域、独立图片 URL、源路径及已替换旧 UI 路径的映射，以及体积统计。

合图保持压缩图片的尺寸和宽高比，不旋转、不裁掉透明区域、不缩放。每张图四边留 4 像素，其中紧邻图片的 2 像素复制边缘颜色，其外留 2 像素透明间隔，避免双线性采样串色。合图使用 `-lossless -q 100 -m 6 -exact`，写出时核对解码后的全部 RGBA 像素与画布相同，不引入第二次有损压缩。这里的 `q100` 是无损编码的压缩力度；合图的主要收益是减少图片文件和加载请求，编码后的总体积可能高于已有单图。

区域按压缩目录的根路径索引。例如 `images["/ui/battle/digits-v2/benefit/0.webp"]` 返回 `{atlas, x, y, width, height}`，坐标单位为像素，原点位于图集左上角。Canvas 可通过 `drawImage(image, x, y, width, height, ...)` 裁取。独立图片条目返回 `{url, width, height}`，SVG 不记录像素尺寸。旧 PNG 或被替换素材先在 `aliases` 中查询，再访问 `images`。

只写入 `sprites` 和 `sprite-images.json`，源资产和现有 public 单图保留。再次运行会替换本脚本的输出，并删除上一份清单记录的过期文件。3D 模型贴图、地面、水面、环境背景、小地图和普通特效继续独立存放在压缩目录；模型 UV 无需调整。试压候选、预览、分析报告和工具脚本不参与合图。

网页的 `image-assets.json` 会附带精灵图清单，并排除已合图图片及其旧路径，避免预加载重复下载单图。启动时解码图集，坦克宠物缩略图及印章的 Vite URL 也映射到同一份资源。Canvas 和战斗 UI 共用图集图像与区域坐标；`ImageArtwork` 用 SVG 视窗裁取，保留拉伸和等比适配。既有 `<img>`、CSS 背景、重复平铺和光标从已解码图集按需裁成内存图片，不产生额外网络请求或磁盘 PNG。

`restore-original-assets.py` 会清除 public 中的精灵图输出，恢复原图后需重新运行本脚本。public 中没有精灵图清单时，加载器继续读取独立图片。此次接入仅处理 UI 和共享状态图标，模型等其它资产继续使用现有加载路径。
