# 高清资产压缩与精灵图

从 `art/hd` 生成 `art/compressed`。入口与配方位于 `scripts`，空输出目录也能生成完整资产，不读取已有压缩图片、历史报告、`art/original` 或应用源码。

美术源目录见[运行美术资源](original-assets.md)，发布目录分类与路径解析见[public 资源目录](public-assets.md)。

## 执行流程

安装下述依赖后，在仓库根目录执行：

```bash
# art/hd → art/compressed
npm run assets:compressed

# 从已有 art/compressed 生成精灵图，输出到 apps/web/public
npm run assets:sprites

# 发布原版与HD两套战斗贴图
npm run assets:battle-artwork
```

只需压缩资产时执行第一条；只更新精灵图时执行第二条，直接读取压缩成品。战斗素材发布也直接复用现有压缩成品。压缩入口也可直接执行 `python3 scripts/generate-compressed-assets.py`。高清源文件保持原样。

## 新增与更新图片

原始图片按运行资源相对路径保存到 `art/hd/`，在 `recipe.json` 中记录源路径、输出路径、源尺寸、最终尺寸、类别及编码方案。public 是发布目录，修改后的源图应同步保存到 HD 目录，再从源图生成压缩成品。

单独处理大厅欢迎图：

```bash
npm run assets:compressed -- --image ui/lobby/welcome-banner.webp
npm run assets:sprites
```

`--image` 接受配方中的源路径或输出路径，可重复指定多张图，只处理选中的独立图片。结果写入 `art/compressed/reports/selected-assets.json`，完整生成报告保持原样。每次从 HD 源图编码，不读取已有压缩成品；JSON 引用和模型内嵌图片的更新使用完整生成入口。

欢迎图的 HD 源文件是 `art/hd/ui/lobby/welcome-banner.png`。配方保留像素画的 3584×486 原尺寸，使用 UI 的 near80 编码；生成精灵图时因宽度超过 2048，发布为 `assets/ui/images/lobby/welcome-banner.webp`，原 `/ui/lobby/welcome-banner.webp` 引用通过清单映射到该文件。

新增或更新 UI 图片后运行 `assets:sprites`，只读取压缩成品，更新 UI 图集、独立图片及映射。新增战斗模型或特效素材后运行 `assets:battle-artwork`。开发环境刷新页面会重新扫描发布目录并更新图片缓存；生产环境重新构建前端，发布图片和资源清单。

## 依赖与参数

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

可使用 `--source`、`--output`、`--recipe`、`--workers` 和 `--image`。默认输出沿用 `art/compressed`；如需 `art/compress`，加上 `--output art/compress`。已有输出中的资产会按高清源图重新生成，每次均从源图开始，避免反复有损编码。

## 尺寸与编码规则

[recipe.json](../scripts/asset_compression/recipe.json) 记录独立图片和模型内嵌图片的源路径、最终尺寸、分类与编码方案，以及 UI 旧图替换规则。最终尺寸采用已确认的 UV 面积计算结果，并记录坦克参考密度和计算依据。该配方固定当前资产集；新增图片、调整显示用途或修改源图尺寸时，更新对应条目。

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

源输入和输出路径重叠时，入口拒绝执行。

## 精灵图输出

从压缩目录读取 UI、字形、坦克和宠物缩略图，以及共享战斗状态图标，输出到网页 public 目录：

```bash
python3 scripts/generate-sprite-assets.py
```

也可执行 `npm run assets:sprites`。完整生成顺序为 `npm run assets:compressed`，再执行 `npm run assets:sprites`；只更新精灵图时单独执行后者即可，读取当前压缩成品。

默认输入 `art/compressed`，默认输出 `apps/web/public`；也接受 `CDTANK_WEB_ASSETS` 环境变量。支持 `--source`、`--output`、`--recipe`、`--page-size`、`--cwebp` 和 `--workers`，依赖与压缩脚本相同。

- `public/assets/ui/atlases/*.webp`：按界面用途、原图集区域和战斗数字分组的精灵图，默认最长边不超过 2048，按实际内容尺寸输出。
- `public/assets/ui/images/`：保留原样的全屏背景、放不进图集的大图、SVG、ICO 和只能独占一页的单图。
- `public/manifests/sprite-images.json`：图片区域、独立图片 URL、源路径及已替换旧 UI 路径的映射，以及体积统计。

配方生成 2,487 张图片，其中 2,425 张合入 57 张 WebP 图集，62 张独立发布。被合图的输入共 30,649,032 字节，图集共 34,141,492 字节；独立图片共 41,508,840 字节。无损合图减少请求，图集编码体积高于已压缩单图；统计随生成写入清单的 `summary`。

合图保持压缩图片的尺寸和宽高比，不旋转、不裁掉透明区域、不缩放。每张图四边留 4 像素，其中紧邻图片的 2 像素复制边缘颜色，其外留 2 像素透明间隔，避免双线性采样串色。合图使用 `-lossless -q 100 -m 6 -exact`，写出时核对解码后的全部 RGBA 像素与画布相同，不引入第二次有损压缩。这里的 `q100` 是无损编码的压缩力度；合图的主要收益是减少图片文件和加载请求，编码后的总体积可能高于已有单图。

区域按压缩目录的根路径索引。例如 `images["/ui/battle/digits-v2/benefit/0.webp"]` 返回 `{atlas, x, y, width, height}`，坐标单位为像素，原点位于图集左上角。Canvas 可通过 `drawImage(image, x, y, width, height, ...)` 裁取。独立图片条目返回 `{url, width, height}`，SVG 不记录像素尺寸。旧 PNG 或被替换素材先在 `aliases` 中查询，再访问 `images`。

生成后自动按 public 分类归档，并删除被图集或独立成品替代的 UI 副本。再次运行会替换本脚本的输出，清理上一份清单记录的过期文件，保留其它已登记的独立 UI 图片。3D 模型贴图、地面、水面、环境背景、小地图和普通特效由各自发布入口处理；模型 UV 无需调整。试压候选、预览、分析报告和工具脚本不参与合图。

网页的 `manifests/image-assets.json` 会附带精灵图清单，并排除已合图图片及其旧路径，避免预加载重复下载单图。启动时解码图集，坦克宠物缩略图及印章的 Vite URL 也映射到同一份资源。Canvas 和战斗 UI 共用图集图像与区域坐标；`ImageArtwork` 用 SVG 视窗裁取，保留拉伸和等比适配。既有 `<img>`、CSS 背景、重复平铺和光标从已解码图集按需裁成内存图片，不产生额外网络请求或磁盘 PNG。

首次进入只预加载清单中的 UI 图集、独立图片，以及 `assets/ui/`、`assets/minimaps/markers/` 下的其余 UI 图片和源码图标、缩略图。下载与解码按最终发布地址去重。`manifests/image-assets.json` 仍登记全部图片的缓存版本；坦克皮肤、地图、模型和场景贴图由实际使用流程加载。

`restore-original-assets.py` 用于原来源单图维护，会移除 UI 图集并整理输出。恢复或重建后执行精灵图与双画质战斗发布入口，生成当前客户端所需的清单。

## 怀旧与HD战斗素材

设置页提供独立的“怀旧画质／HD画质”，默认 HD；渲染分辨率单独提供 0.25×、0.5×、1×、1.5×、2× 五档。素材选项只切换战斗场景中的战车、履带、宠物、饰品、地图物件、地面水面、环境模型和特效贴图。UI、字形、小地图及商城、我的家等预览场景保持当前素材。全部显示选项见[显示设置](display-settings.md)。

选择先保留为草稿，点击确定后保存到 `cdtank.battle-artwork.v1`；画质发生变化时重新载入客户端，用同一组选定素材重新创建战斗模型。取消不会切换。刷新后的登录、房间与对局恢复沿用[路由与会话恢复](navigation.md)。

```bash
npm run assets:battle-artwork
# 自定义编码器
python3 scripts/generate-battle-artwork.py --cwebp /path/to/cwebp
```

脚本读取 `art/original` 和已有 `art/compressed`，输出：

- `apps/web/public/assets/textures/original/`、`assets/models/original/`：原尺寸的无损 WebP 贴图及对应模型。
- `apps/web/public/assets/textures/hd/`、`assets/models/hd/`：直接复制压缩成品的贴图及模型。
- `apps/web/public/manifests/battle-artwork.json`：两套资源 URL 映射、原版来源、尺寸及共用素材清单。

原版图片采用 `-lossless -q 75 -m 4 -exact`，保留全部 RGBA 像素。GLB 保留压缩模型的几何、UV 和动画，只替换内嵌贴图；外部贴图在各自画质目录中读取。UI 图片和精灵图不参与发布。生成后自动按 public 分类归档；再次执行替换本脚本的输出并清理上一份战斗清单中的过期文件，保留原始素材。

支持 `--original`、`--compressed`、`--verified`、`--output`、`--recipe`、`--cwebp` 和 `--workers`；输出也接受 `CDTANK_WEB_ASSETS`。缺少原版导出图片时，可从 `recovery/output/verified/assets/data` 的同名 DDS、TGA 或 BMP 读取原版。没有原版对应项的素材由两种画质共用，并在清单中标记 `shared`。

当前 `battle-artwork.json` 记录 2,324 张战斗贴图、967 个模型，其中 2,246 张图片有原版来源，1 张模型内嵌图片恢复原版。共用的 78 张图片为 74 张补充履带动画帧、2 张地形采用贴图和 2 张自定义地图贴图；发布数量与覆盖范围由清单的 `summary` 和 `textures` 记录。

## 限制

素材生成已核对原版图片的尺寸与 RGBA 像素，以及模型的外部图片引用；客户端切换尚未进行游戏内视觉验收。房间恢复沿用现有 30 秒断线保留窗口，重新加载超过该窗口时需返回大厅重新加入。
