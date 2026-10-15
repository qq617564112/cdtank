# 高清资产压缩与精灵图

从 `art/hd` 生成桌面资产 `art/compressed` 和移动端 HD 战斗资产 `art/compressed-mobile`。入口与配方位于 `scripts`，空输出目录也能生成完整资产，不读取已有压缩图片、历史报告、`art/original` 或应用源码。

美术源目录见[运行美术资源](original-assets.md)，发布目录分类与路径解析见[public 资源目录](public-assets.md)。

音频使用独立的 `arts/audio/` → `arts/compressed-audio/` → public 流程，入口为 `npm run assets:audio`；原 WAV 编为 Opus，MP3 保留，逐文件更新与参数见[音频提取、压缩与发布](audio-compression.md)。

模型描边法线、MV3 姿态去重和 CVD 几何布局通过离线 WebAssembly 内核预计算，生成与发布入口自动接入；已有资产可执行 `npm run assets:geometry` 增量更新。依赖、数据格式及目录规模见[几何数据离线预计算](geometry-preprocessing.md)。

## 执行流程

安装下述依赖后，在仓库根目录执行：

```bash
# art/hd → art/compressed
npm run assets:compressed

# art/hd → art/compressed-mobile，战斗贴图尺寸与怀旧版一致
npm run assets:compressed-mobile

# 从已有 art/compressed 生成精灵图，输出到 apps/web/public
npm run assets:sprites

# 发布怀旧、电脑 HD 和移动端 HD 战斗贴图
npm run assets:battle-artwork
```

桌面资产执行 `assets:compressed`，移动端 HD 战斗资产执行 `assets:compressed-mobile`；只更新精灵图时执行 `assets:sprites`，直接读取压缩成品。战斗素材发布直接复用两份压缩成品。HD 压缩入口也可直接执行 `python3 scripts/generate-compressed-assets.py`，加 `--mobile` 生成移动端版本。高清源文件保持原样。

## 新增与更新图片

原始图片按运行资源相对路径保存到 `art/hd/`，在 `recipe.json` 中记录源路径、输出路径、源尺寸、最终尺寸、类别及编码方案。public 是发布目录，修改后的源图应同步保存到 HD 目录，再从源图生成压缩成品。

单独处理大厅欢迎图：

```bash
npm run assets:compressed -- --image ui/lobby/welcome-banner.webp
npm run assets:sprites
```

`--image` 接受配方中的源路径或输出路径，可重复指定多张图，只处理选中的独立图片。结果写入 `art/compressed/reports/selected-assets.json`，完整生成报告保持原样。每次从 HD 源图编码，不读取已有压缩成品；JSON 引用和模型内嵌图片的更新使用完整生成入口。

欢迎图的 HD 源文件是 `art/hd/ui/lobby/welcome-banner.png`。配方保留像素画的 3584×486 原尺寸，使用 UI 的 near80 编码；生成精灵图时因宽度超过 2048，发布为 `assets/ui/images/lobby/welcome-banner.webp`，原 `/ui/lobby/welcome-banner.webp` 引用通过清单映射到该文件。

新增或更新 UI 图片后运行 `assets:sprites`，只读取压缩成品，更新 UI 图集、独立图片及映射。新增战斗模型或特效素材时，配方同时记录 `mobile_target_size` 和 `mobile_size_basis`，生成 compressed 与 compressed-mobile 后运行 `assets:battle-artwork`；独立贴图可分别用两个压缩命令的 `--image` 增量生成。开发环境刷新页面会重新扫描发布目录并更新图片缓存；生产环境重新构建前端，发布图片和资源清单。

怀旧小地图使用独立路径：`art/hd/cartoon-minimaps/original/{id}.webp` 保留对应 HD 底图的 1024×1024 源文件，配方从源图一次缩放为 512×512，以 `keep-source` 的无损 WebP 编码写入 `art/compressed/cartoon-minimaps/original/`，再用 `assets:publish -- --image cartoon-minimaps/original/{id}.webp` 发布到 `apps/web/public/assets/minimaps/backgrounds/original/`。26 张底图共 14,314,428 → 12,979,854 字节，减少约 9.3%；解码后的单份像素量减少 75%。HD 小地图继续使用 1024×1024 的原路径。运行时动态标记和边框的密度见[显示设置](display-settings.md#战斗材质选择)。

主屏幕安装图标沿用客户端 ICO 的 32×32 像素网格，HD 导出保留该图案，尺寸分别为 180×180、192×192 和 512×512。源文件位于 `art/hd/ui/app-icons/`，成品位于 `art/compressed/ui/app-icons/`，配方采用 `keep-source` 并保留 PNG；压缩入口核对源尺寸与最终尺寸一致后直接复制，适配 Apple 主屏幕图标及 Android manifest。`assets:sprites` 将这些图标作为独立图片发布到 `apps/web/public/assets/ui/images/app-icons/`。游戏内栅格贴图继续使用 WebP。

| 文件 | 最终尺寸 | 编码 | HD／compressed／public 字节数 |
| --- | --- | --- | --- |
| `client-icon-180.png` | 180×180 | PNG，无损 | 2,201／2,201／2,201 |
| `client-icon-192.png` | 192×192 | PNG，无损 | 2,184／2,184／2,184 |
| `client-icon-512.png` | 512×512 | PNG，无损 | 3,788／3,788／3,788 |

三张图共 8,173 字节，各阶段保持同一编码与体积。

系统设置的四张画面调节图标保存在 `art/hd/ui/settings/`，源图为带透明通道的无损 WebP。界面显示尺寸为48×39并放大1.3倍，4K尺寸需求超过源图时保持192×156，不放大；配方使用 `keep-source`，`art/compressed/ui/settings/` 保留原编码与字节数。

| 文件 | 最终尺寸 | HD／compressed 字节数 | 发布图集 |
| --- | --- | --- | --- |
| `brightness-shiba-label.webp` | 192×156 | 20,844／20,844 | `ui-002.webp` |
| `saturation-husky.webp` | 192×156 | 24,874／24,874 | `ui-005.webp` |
| `contrast-cat.webp` | 192×156 | 23,698／23,698 | `ui-002.webp` |
| `resolution-cat.webp` | 192×156 | 26,494／26,494 | `ui-005.webp` |

四张图共95,910字节，从源图到 compressed 体积不变。`assets:sprites` 将它们以无损 WebP 合入 `apps/web/public/assets/ui/atlases/lobby/`，`apps/web/public/manifests/sprite-images.json` 保留 `/ui/settings/<文件名>` 逻辑路径和对应图集区域。页面引用与配方、清单保持一致。加入四图后，发布图集仍为32张，图集总量由57,554,360增至57,715,012字节，增加160,652字节。

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
| 结算专用奖章、胜负横幅 | 长边上限 512，保持宽高比，不放大小图 | near80 |

结算专用素材从 `art/hd/ui/battle/summary/` 编码到 `art/compressed/ui/battle/summary/`：9 张 `award-*.png` 输出为 512×512 的 WebP，`win.png` 输出 512×192，`lose.png` 输出 512×157。HD 源图保留原尺寸；执行 `assets:sprites` 更新 `apps/web/public/assets/ui/atlases/` 及 `manifests/sprite-images.json`，手机与电脑共用这些成品。实时计分板共用的底图和宠物头像沿用原配方尺寸。

这 11 张 HD 源图共 8,027,632 字节，压缩成品由 4,695,686 减至 1,817,464 字节，减少 61.3%。单份 RGBA 像素量由 38.71 MiB 降至 9.68 MiB，减少 29.03 MiB；图集空白区域和浏览器副本另计。

发布图集按大厅、手机战斗、电脑战斗分为三套，共 32 张。结算素材进入两套战斗包，11 张图片继续保持上述配方尺寸与源路径别名；合图采用无损 WebP，编码入口核对像素一致性。

保持宽高比，不放大小图。源图先直接缩放一次到最终尺寸，再生成无损基准和最终编码候选，采用较小文件。q95 使用 `-m 6 -sharp_yuv -alpha_q 100 -alpha_filter best`。near80 先处理不透明 RGB，再恢复原 Alpha、全透明区域 RGB 和纯黑 RGB，必要时用无损 WebP 封装；每张核对最终 RGB 通道差不超过 1/255。无损基准使用 `-lossless -q 75 -m 4 -exact`。原本有损且不改尺寸的 WebP 直接保留。

应用内缩略图和印章的 34 个输入副本位于 `art/hd/bundled-ui`，保留高清源文件；输出为 `bundled-ui` 中的 33 张 WebP 和 1 个 ICO。生成期间的 PNG 仅存在于输出目录下的临时工作目录，完成后删除。

JSON 资源引用、UI 替换和 GLB 外部图片同步改为 WebP。GLB 内嵌图片保留在模型中，使用 `EXT_texture_webp`，非图片缓冲区内容保留。制作预览和已替换旧图不输出，运行目录和应用代码不修改。

结果写入 `reports/generated-assets.md`、`reports/generated-assets.json`、`reports/generated-assets.csv` 和 `reports/runtime-files.json`。体积统计只包含生成的运行资产，不包含历史试压样本、脚本和报告。临时编码文件不计入资产。

源输入和输出路径重叠时，入口拒绝执行。

## 精灵图输出

从 `art/compressed` 读取已有 UI 图片、字形和缩略图，按大厅、手机战斗、电脑战斗生成三套独立资源：

```bash
npm run assets:sprites
```

图片源图和压缩配方的顺序保持 `art/hd` → `recipe.json` → `art/compressed` → `apps/web/public`。仅拆分图集时不修改源图、不重复有损编码，直接读取现有 compressed 成品。完整生成顺序为 `npm run assets:compressed`，再执行 `npm run assets:sprites`。

`recipe.json` 的 `ui_sprite_scopes` 记录各套的布局、imageset、图片路径及公共依赖。生成器从 compressed 中的 `ui.json`、`ui-fonts.json`、`chat-emote-sequences.json` 解析依赖，将共享图片复制到每套所需的包。新增界面图片需要同步更新所属包的配方选择规则。手机 HUD 使用原生组件，不包含电脑 `game_main.xml` 和模式 HUD 布局；计分板、聊天与结算布局计入两端战斗包。

UI 收集包含 `ui/` 下的图片，保留按 `minimap_keep` 编码的地图预览与小地图边框。`xiaoditu0` 的 50 张 106 × 86 预览进入大厅包，供地图选择、房间卡片及等待房间按地图编号引用；战斗小地图底图继续由独立战斗资源入口发布。

默认输入 `art/compressed`，默认输出 `apps/web/public`；也接受 `CDTANK_WEB_ASSETS` 环境变量。支持 `--source`、`--output`、`--recipe`、`--page-size`、`--cwebp` 和 `--workers`，依赖与压缩脚本相同。

- `public/assets/ui/atlases/{lobby,mobile-battle,desktop-battle}/`：各套独立图集，按字体、电脑远端头像和其它 UI 分组。
- `public/assets/ui/images/{lobby,mobile-battle,desktop-battle}/`：各套独立的大图、全屏背景、SVG、ICO 和只能独占一页的图片副本。
- `public/assets/ui/images/app-icons/`：主屏幕安装图标保留 web manifest 使用的固定地址，不参与界面预加载。
- `public/manifests/sprite-images.json`：版本 2，包含全部图集、逻辑路径别名、三套 `scopes` 及体积统计。

合图保持 compressed 图片的尺寸、宽高比及透明区域，不旋转、不裁切、不缩放，最长边不超过 2048，按实际内容尺寸输出。每张图四边留 4 像素，紧邻图片的 2 像素复制边缘颜色，其外留 2 像素透明间隔。合图使用 `-lossless -q 100 -m 6 -exact`，写出时核对解码后的全部 RGBA 像素与画布相同，不引入第二次有损压缩。

`scopes[scope].images` 按逻辑路径索引。区域条目为 `{atlas, x, y, width, height}`，独立图片为 `{url, width, height}`；SVG 不记录像素尺寸。旧 PNG 或替换路径先通过顶层 `aliases` 解析，再查询当前包。顶层 `images` 是全部逻辑图片的索引，用于生成资源目录；运行时使用所选包的映射。

每套 `preload` 只列主动下载和解码的发布文件。加载背景及技能状态图保留在对应 `images` 中，按实际显示需要准备；每套统计记录图集数量、编码字节数、独立图片字节数和主动预加载的单份 RGBA 像素量。三套共享图片各存一份，增加发布文件总量；每次只加载当前场景所需的包。

| 场景 | 图集数 | 主动预加载单份 RGBA | 减少 | 当前预加载文件 |
| --- | --- | --- | --- | --- |
| 大厅（手机入口） | 49 → 9 | 295.34 → 174.11 MiB | 121.23 MiB（41.0%） | 25.30 MiB |
| 大厅（电脑入口） | 55 → 9 | 372.67 → 174.11 MiB | 198.56 MiB（53.3%） | 25.30 MiB |
| 手机战斗 | 34 → 8 | 206.92 → 115.52 MiB | 91.40 MiB（44.2%） | 15.06 MiB |
| 电脑战斗 | 40 → 15 | 284.25 → 207.49 MiB | 76.76 MiB（27.0%） | 23.57 MiB |

图集共 57,715,012 字节，三套独立图片共 95,583,346 字节，安装图标 8,173 字节。UI 发布文件总量由 73,611,093 增至 153,306,531 字节，增加 76.00 MiB；其中包含共享图片、加载背景和技能状态图的副本。主动预加载统计不含按需准备的背景、状态图和桌面车型标记，单份 RGBA 不等同于浏览器进程内存。

生成后按 public 分类归档，清理上一份清单中的过期图集和各套独立图片。3D 模型、场景贴图、小地图底图和普通特效继续由各自入口发布。网页 `manifests/image-assets.json` 附带三套映射并登记全部文件的版本，排除已合图单图和旧路径。Canvas 与 `ImageArtwork` 复用当前图集；`img`、CSS 平铺背景和光标按需裁出内存图片。

`restore-original-assets.py` 用于原来源单图维护，会移除 UI 图集并整理输出。恢复或重建后执行精灵图及怀旧、电脑 HD、移动端 HD 三份战斗材质发布入口，生成当前客户端所需清单。

## 怀旧与HD战斗素材

设置页提供独立的“怀旧画质／HD画质”，默认 HD；渲染分辨率单独提供 0.25×、0.5×、1×、1.5×、2× 五档。素材选项只切换战斗场景中的战车、履带、宠物、饰品、地图物件、地面水面、环境模型和特效贴图。UI、字形保持既有素材，小地图和商城、我的家等预览的尺寸规则见下文。全部显示选项见[显示设置](display-settings.md)。

选择先保留为草稿，点击确定后保存到 `cdtank.battle-artwork.v1`；画质发生变化时重新载入客户端，用同一组选定素材重新创建战斗模型。取消不会切换。刷新后的登录、房间与对局恢复沿用[路由与会话恢复](navigation.md)。

手机、平板和电脑均在设置页选择怀旧或 HD，默认 HD，保存与取消使用相同规则。移动端怀旧读取 original，HD 读取 mobile-hd；电脑 HD 读取 hd。商城与我的家预览保持 HD 美术，移动端使用 mobile-hd 的缩小版本。全局设备识别同时负责横屏：支持方向锁定的浏览器锁定 landscape，其余浏览器在竖屏显示覆盖层并阻止操作，转为横屏后恢复。移动端登录页隐藏“加载资源包”，实际地图、模型与贴图按场景载入。

```bash
npm run assets:battle-artwork
# 自定义编码器
python3 scripts/generate-battle-artwork.py --cwebp /path/to/cwebp
```

移动端压缩逐张使用配方的 `mobile_target_size`，从 HD 源图一次缩放到对应怀旧贴图尺寸，继承该图的 q95、near80 或 keep-source 编码方案。`mobile_size_basis` 记录尺寸来源；没有原版来源的共用素材沿用怀旧发布时的桌面目标尺寸。模型内嵌图片同样按原版 GLB 图片尺寸处理，模型的几何、UV 和动画保持一致。UI 使用既有 compressed 与精灵图；移动端两档画质均使用既有 512×512 小地图底图及一倍密度标记。

```bash
npm run assets:compressed-mobile
# 增量更新独立贴图
npm run assets:compressed-mobile -- --image Data/Pet/001/d12.png
```

移动端入口接受与桌面入口相同的 `--source`、`--output`、`--recipe`、`--cwebp`、`--workers` 和 `--image` 参数；默认输出 `art/compressed-mobile`，仅生成战斗贴图与模型。完整报告为 `art/compressed-mobile/reports/generated-assets.json`，增量报告为 `selected-assets.json`。

脚本读取 `art/original`、已有 `art/compressed` 和 `art/compressed-mobile`，输出：

- `apps/web/public/assets/textures/original/`、`assets/models/original/`：原尺寸的无损 WebP 贴图及对应模型。
- `apps/web/public/assets/textures/hd/`、`assets/models/hd/`：直接复制压缩成品的贴图及模型。
- `apps/web/public/assets/textures/mobile-hd/`、`assets/models/mobile-hd/`：直接复制移动端 HD 成品，贴图尺寸与怀旧版相同。
- `apps/web/public/manifests/battle-artwork.json`：original、hd、mobile-hd 三份资源 URL 映射、原版来源、三份尺寸及共用素材清单。

原版图片采用 `-lossless -q 75 -m 4 -exact`，保留全部 RGBA 像素。GLB 保留压缩模型的几何、UV 和动画，只替换内嵌贴图；外部贴图在各自画质目录中读取。UI 图片和精灵图不参与发布。生成后自动按 public 分类归档；再次执行替换本脚本的输出并清理上一份战斗清单中的过期文件，保留原始素材。

支持 `--original`、`--compressed`、`--compressed-mobile`、`--verified`、`--output`、`--recipe`、`--cwebp` 和 `--workers`；输出也接受 `CDTANK_WEB_ASSETS`。缺少原版导出图片时，可从 `recovery/output/verified/assets/data` 的同名 DDS、TGA 或 BMP 读取原版。没有原版对应项的素材沿用 HD 来源，并在清单中标记 `shared`。发布时核对每张 mobile-hd 的尺寸与 original 及配方一致。

当前 `battle-artwork.json` 记录 2,324 张战斗贴图、967 个模型，其中 2,246 张图片有原版来源，1 张模型内嵌图片恢复原版。共用的 78 张图片为 74 张补充履带动画帧、2 张地形采用贴图和 2 张自定义地图贴图；发布数量与覆盖范围由清单的 `summary` 和 `textures` 记录。


移动端 HD 成品由 libwebp 1.2.4 生成：2,324 张外部贴图和 967 个模型，另含 1 张 512×512 模型内嵌贴图。外部贴图从 HD 源图共 6,672,976,284 字节生成 56,948,062 字节；相对桌面 compressed 的 544,649,394 字节减少 89.5%。实际采用 q95 1,938 张、near80 329 张，其余 57 张保留基准编码。内嵌地面贴图从 1,978,640 字节压缩为 65,370 字节。逐图尺寸、编码与体积见 `art/compressed-mobile/reports/generated-assets.json`，桌面／移动端汇总见同目录 `comparison.json`。

| 资源 | HD 源路径 | 移动端成品与发布路径 | 最终尺寸 | 编码 |
| --- | --- | --- | --- | --- |
| 外部战斗贴图 | `art/hd/<配方 source_relative>` | `art/compressed-mobile/<output_relative>` → `apps/web/public/assets/textures/mobile-hd/` | 逐张与怀旧版一致；2,246 张采用原版尺寸，78 张沿用共用尺寸 | 不透明图 q95，透明／特效图 near80，按配方保留 keep-source |
| 模型内嵌地面图 | `art/hd/custom-maps/1001/ground.glb#images/0` | `art/compressed-mobile/custom-maps/1001/ground.glb` → `apps/web/public/assets/models/mobile-hd/maps/custom/1001/ground.glb` | 2048×2048 → 512×512 | q95 WebP |

外部贴图的总像素量为 294,163,968，对应桌面配方为 4,323,262,464，减少 93.2%。这是全目录尺寸汇总，不代表单局显存或真机内存实测。

## 限制

素材生成已核对原版图片的尺寸与 RGBA 像素，以及模型的外部图片引用；客户端切换尚未进行游戏内视觉验收。移动端两档画质的显存占用取决于当前场景实际加载的贴图与模型；没有原版来源的共用素材保留其既有尺寸。浏览器不支持方向锁定时，需要将设备实际转为横屏，竖屏覆盖层阻止页面操作。房间恢复沿用现有 30 秒断线保留窗口，重新加载超过该窗口时需返回大厅重新加入。
