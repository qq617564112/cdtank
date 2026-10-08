# 高清贴图

图片生成与编辑统一使用 `scripts/hd_image_api.py`，请求 `http://192.168.10.140:13999/v1/images/edits` 的 `gpt-image-2.5-sunburst` 模型。密钥从 `CHATGPT2API_KEY` 或终端隐藏输入读取，不写入项目文件。

优先处理坦克、宠物和地图贴图，再完成美术、特效、图标与全部界面图片。已确认的田野路交付直接复用。静态文字和数字同样纳入高清图片范围。

独立地图 `1002` 的 85 张高清贴图及地图预览也直接复用已确认的田野路交付，保留其现有高清尺寸。

测试地图 `1001` 的砖墙、钢墙和地面模型分别复用 `obj05443.png`、`dimian01.png` 与 `tiandi.png` 的高清交付。地图选择预览 SVG 的地面、墙体、木箱和草丛同步替换内嵌图片，保留原布局，不增加图片接口调用。

每次宠物请求只包含一只宠物；坦克请求只包含同一款坦克的贴图。UI 碎片先按原布局拼成完整面板、条带或控件再请求高清重绘，返回后按原坐标切片。所有图案使用图片；带文字按钮使用无字高清 PNG，并按原文字位置叠加字体。

运行端按图片清单加载高清交付。模型几何、UV、动画和缓冲区沿用原资源。已确认的界面布局、Logo、光标、应用图标与角色肖像继续复用；原图及原高清版本保留备份。

界面中的坦克和宠物肖像从高清模型离线重绘，同时写入原 UI 区域和本地缩略图目录。这些肖像使用各角色单独生成的贴图，不再放进多角色 UI 拼图请求。

剩余修正及高清化请求中的多素材拼图统一使用宽留白和定位边框。1024×768 参考图的外留白为 40 像素、格间距为 64 像素，每格使用 6 像素蓝色矩形框，素材距框至少 48 像素；同组原图使用统一放大比例，保留完整画布与透明留白。每批按同一图集家族和美术风格分组，通常最多四格，大型素材独立请求。聊天表情按动画家族分组，大尺寸气泡、小尺寸圆脸各自请求，保持每一帧的五官、文字及空白差异。

请求要求接口保持蓝框、间距和纯洋红底。返回后识别各格实际蓝框内沿，裁掉定位框与间距，再去除洋红透明区，等比缩放回原图占位；闭合边框无法识别时保留原响应，并按实际素材边界裁切。复杂插画与艺术字由图片接口绘制，本地图片处理使用参考拼接、裁切、透明处理、缩放和安装。带文字按钮只在无字图片上叠加字体文字。

已核对的候选按接受清单发布，安装器同步高清交付、原独立图片备份及运行精灵图中的对应格子，保留原映射和尺寸；同格别名同步使用同一候选。原高清交付和受影响的原运行精灵图保存在 `art/hd-ui-redraw/previous/`。

艺术字请求使用专用提示词，以白字黑底呈现真实笔画，保留原字体的比例、粗细、衬线和复古风格，重绘完整的连续轮廓。艺术字和单色控件的透明轮廓直接来自接口图像，扣除黑底后恢复原色。输入处理使用 `scripts/prepare-hd-monochrome-ui.py`，保留现有拼图坐标和批次。

加载页的十份进度文字纳入 UI 拼图请求，以白色真实透明笔画铺在黑底上；返回笔画生成高清透明遮罩并恢复原文字颜色，安装器按清单的 `installPath` 替换本地图片。

含多个坦克或宠物的四张宣传横幅按原坐标分层，底图单独生成，每个坦克、宠物或人物分别请求；高清图层齐全后组装原横幅。只含人物的横幅保持整图独立请求。图层配置位于 `scripts/hd-banner-layers.json`。

宣传横幅的有效插画区域为 512×80，下面 48 像素为透明留白。组装器去除接口返回底图中的实色留白，将插画定位回原区域，再叠加独立角色并恢复原透明遮罩。

拆分图层仅在美术目录参与组装，安装器发布完成的背景、横幅及原图集。

独立角色图层直接提取接口绘制的颜色，去除洋红色排除区域，并与原裁切遮罩相交。遮挡关系和位置按原图层坐标保持。

五张加载背景标记为 `loading-layout`，由 `scripts/prepare-hd-loading.py` 从原图恢复完整的 800×600 画面，每张画面中的角色、坦克、Logo 与背景一起请求高清重绘。接口保留原版卡通画风、构图和遮挡关系，去掉固定 LOADING 字样与点号，并补全字下画面；两侧自然扩展为 16:9。4:3 从同一张完整重绘结果的中央原稿区域裁出。五个整图请求作为 `loading` 组加入生成队列。

五张加载背景的接口原生尺寸为 1672×940 或 1672×941，统一缩放为 4268×2400 的 16:9 交付图；中央 4:3 交付尺寸为 3200×2400。两种比例共用完整画面。页面按窗口比例选择背景，进度文字、坦克、状态与操作按钮放在居中的 800×600 逻辑区域；启动与对局加载共用此布局。成品预览位于 `art/hd-ui/loading/preview.html`，同目录的 `installation.json` 记录原生尺寸及两种布局的裁切关系，`whole-backgrounds/inspection.json` 记录交付与发布文件核对。

原 UI 图集从已经完成的高清区域按原始坐标重新组装，避免把多个坦克或宠物作为整幅图集交给接口；其它空白区域沿用原布局。DDS 原图的扫描线与 UI 区域坐标相反，组装时先翻至 UI 坐标，完成后翻回原贴图方向。混合图集中的静态文字与数字使用各自的高清图片。图集组装使用 `scripts/assemble-hd-ui-atlases.py`，输出同样纳入安装清单。

图集组装只覆盖具有原始 XPos/YPos 的区域。地图列表引用的独立 SVG 与 PNG 预览继续直接加载。

请求画幅由输入拼图和提示词指定，实际返回尺寸记录在调用账本。新生成 PNG 按原尺寸的四倍保存，已确认的田野路交付及共享素材保留现有高清尺寸；生成结果通过轮廓配准、局部色调校正与原透明遮罩保持 UV 图集位置。地图贴图保留更宽的原图边缘过渡，避免道路断口和草地色差。几何、UV、材质配置、碰撞及动画数据沿用原资源。

模型材质的 `terrainTextureAdoption.asset` 指向实际使用的替代或跨目录贴图，清单和安装器按该路径关联高清图片。

角色光照使用的 `scene/actor-toon/0.png` 与 `Data/image/toon/0.png` 共用同一份原图和高清交付。

## 文件

- `art/hd-assets/inventory.json`：原路径、原图备份、高清 PNG 路径、共享素材及所属地图。
- `art/hd-assets/plan.json`：批次及处理顺序。
- `art/hd-assets/calls.json` 与 `pilot-call.json`：请求结果及实际返回尺寸。
- `art/hd-assets/batches/`：输入拼图、提示词和返回图片。
- `art/hd-assets/png/`：完成的高清 PNG。
- `art/hd-assets/original/` 与 `original-models/`：原图与模型备份。
- `art/hd-assets/uncompressed/`：压缩前的高清交付、运行 PNG、GLB、地图选择预览及本地缩略图，按项目相对路径保存；`manifest.json` 记录文件范围和原体积。
- `art/hd-assets/lossless-compression.json`：逐份 PNG 像素与色彩配置核对、模型内嵌图片与几何核对，以及压缩前后体积统计。
- `art/hd-assets/previews/`：使用同一份原模型离线绘制的原图与高清图对照。
- `art/hd-assets/asset-gallery.html`：离线资源对照页，支持分类、路径搜索、完成状态筛选与原始像素放大；静态文字与数字纳入图片资源范围。每组安装后自动刷新资源快照。
- `art/hd-assets/installation-inspection.json`：指定范围内交付 PNG 与运行 PNG 的逐字节对比，以及 GLB 原数据与内嵌图片核对结果；未完成资源单独记录。全量核对还覆盖清单外资源、普通文字原图、两种比例界面布局、Logo、光标和应用图标。
- `art/hd-assets/model-image-coverage.json`：全量模型的实际材质贴图关联情况。田野路模型合并重复材质引用后留下的 34 份未引用内嵌图片保留原数据；核对报告单独记录这些图片，所有材质实际引用的图片均须关联库存。
- `art/hd-ui/png/lobby/`：共用顶栏、底部剪影、目录板与连续玩家列表底图，以及本地组装的 4:3、16:9 大厅背景。
- `art/hd-ui/loading/whole-backgrounds/`：加载背景完整原图、整图请求及原生返回结果；完成的两种比例背景安装到 `hd-ui/loading/`。
- `art/hd-local-ui/`：本地图标和标志的原图、两份请求输入及交付。标志单独请求，光标与应用图标共用两格图集。
- `art/hd-ui-redraw/`：UI 横向核对、家族提示词、带边框修正请求、原始响应和切图候选；`framed-review/` 为原图与候选对照。
- `art/hd-ui-redraw/button-backgrounds/`：原按钮各状态的无字高清底图，安装到 `hd-ui/buttons/`。
- `apps/web/src/assets/button-artwork.json`：带字按钮的无字图片路径、字体、颜色及文字位置。

## 使用

生成器需要 Pillow、numpy、opencv-python-headless，以及上述技能目录。安装器仅使用 Python 标准库，不调用图片 API。

```sh
python3 scripts/generate-hd-assets.py prepare
python3 scripts/pack-hd-ui-assets.py
python3 scripts/generate-hd-assets.py run --concurrency 8 --ui-concurrency 2
python3 scripts/generate-hd-assets.py generate --groups tanks pets --concurrency 8
python3 scripts/generate-hd-assets.py generate --groups map-0001 --concurrency 8
python3 scripts/generate-hd-local-ui.py run
python3 scripts/generate-hd-ui-layouts.py run --group entry
python3 scripts/prepare-hd-loading.py prepare
python3 scripts/prepare-hd-loading.py generate --workers 2
python3 scripts/prepare-hd-loading.py assemble
python3 scripts/render-hd-asset-gallery.py
python3 scripts/inspect-hd-asset-installation.py --groups pets tanks map-0001
npm run assets:hd
```

剩余 UI 修正使用带定位框的请求与独立候选目录，图片核对后按接受清单安装：

```sh
export CHATGPT2API_KEY='替换成你的原密钥'
python3 scripts/prepare-hd-ui-redraw.py
python3 scripts/prepare-framed-ui-redraw.py
python3 scripts/redraw-hd-ui.py --jobs art/hd-ui-redraw/framed-ui-jobs.json --workers 2
python3 scripts/redraw-hd-ui.py --jobs art/hd-ui-redraw/framed-emote-jobs.json --workers 8
python3 scripts/install-redrawn-ui.py --jobs art/hd-ui-redraw/framed-ui-jobs.json --candidate-dir art/hd-ui-redraw/framed-candidates
python3 scripts/preview-hd-ui-redraw.py --candidate-dir art/hd-ui-redraw/framed-candidates --output-dir art/hd-ui-redraw/framed-review
```

图片生成脚本共用 `scripts/hd_image_api.py`：请求 `http://192.168.10.140:13999/v1/images/edits`，使用 `gpt-image-2.5-sunburst`。multipart 字段为 `model`、`image`、`prompt`、`n=1` 和 `response_format=url`，请求最长等待 1300 秒，再下载返回的 `data[0].url`。`CHATGPT2API_BASE_URL` 可覆盖服务器地址；密钥从 `CHATGPT2API_KEY` 或终端隐藏输入读取。UI 修正器保存响应 URL，下载失败后复用响应，避免重新生图。

按钮文字参数由 `scripts/ui-manual-*.json` 保存，逐张目视读取原图，记录文字、墨迹位置、描边及透明留白。每个真实按钮状态独立请求完整原图，不使用 OCR。普通静态文字与数字使用高清图片。

`scripts/prepare-raster-button-backgrounds.py` 从实际按钮状态引用准备完整无字按钮请求；`scripts/prepare-raster-ui.py` 按完整控件准备其余 UI 图片。图片请求统一最多 10 路并发。运行图片目录由 Vite 的图片清单插件收录。

图片清理器仅将带文字按钮的原图排除在运行引用之外，运行时引用其无字底图。静态文字、数字、图标与界面切片保留图片引用。`--unused-only` 删除闲置运行图片并重组受影响图集，原图及原高清备份继续保留。

```sh
python3 scripts/prepare-raster-button-backgrounds.py
python3 scripts/redraw-hd-ui.py --jobs art/hd-ui-redraw/raster-button-jobs.json --workers 10
python3 scripts/install-redrawn-ui.py --jobs art/hd-ui-redraw/raster-button-jobs.json --candidate-dir art/hd-ui-redraw/raster-button-candidates
python3 scripts/prepare-button-artwork.py
python3 scripts/inspect-hd-ui-installation.py
python3 scripts/clean-image-assets.py --unused-only
python3 scripts/inspect-clean-image-assets.py
```

生成器跳过已交付贴图，记录失败请求；失败批次自失败时间起等待 300 秒后重试。等待分成不超过 30 秒的片段。重新执行时复用已保存结果及每个批次的剩余等待时间。`--limit` 可设置累计提交上限。`run` 默认以 8 路处理地图及其他美术，另外 2 路专门生成 UI；两队列共用同一份调用账本和 10 路请求容量。最后一个主组剩余批次不超过 8 个时，UI 提前使用空闲容量；主组安装期间也继续处理 UI。各组完成后安装并绘制模型与地图预览，替换本地角色缩略图与小地图图标；UI 生成完成后等主队列结束，再组装并安装图集。Ctrl-C 会停止新增请求，保存所有在途结果后退出。

图片接口失败时，失败批次等待五分钟后重试，其余批次继续处理。服务返回额度不足时，两队列共同等待五分钟，随后降低并发尝试恢复；成功后继续原并发数。已返回图片的本地提取失败保留原响应，按批次重新处理。主队列结束后，其空闲线程自动加入 UI 队列，UI 最多使用两队列的总并发数。

重新打包时保留已经提交过的批次及其编号，使重试时间继续关联原请求；新批次编号也避开历史请求记录。

请求总并发最多 10 路，重试间隔至少 300 秒。已保存响应的提取失败只重试本地提取，更新原调用记录，不再次请求图片接口。

达到重试时间的批次恢复其原处理顺序，优先收尾当前地图、加载页或图集所需的前序素材。

`scripts/generate-hd-ui-layouts.py` 分别重绘大厅上半部蓝色顶栏、下半部剪影和独立目录板。4:3 与 16:9 共用同一套图案：顶栏保留两端装饰，中间蓝色空白带按宽度延展；底部剪影使用同一张宽屏素材，4:3 取中央原稿区域。目录板与玩家列表作为独立图层摆放，控件由界面组件叠加。运行 `python3 scripts/generate-hd-ui-layouts.py assemble` 可重组布局，不再次调用图片接口。

登录页同样从上下两份共用部件组装：4:3 取中央原图区域，16:9 增加两侧背景；表单和按钮随整个内容层居中，保持原逻辑坐标。频道选择页使用同一组框架部件居中排列，遮罩延展到舞台宽度。背包和商店保留居中弹窗及共用分块图案。高清光标用 4x 图像密度显示，热点仍为 2,4，逻辑尺寸仍为 32 像素；应用图标提供 16 至 256 像素的七种尺寸。

`assets:install` 解压原资源后安装已经完成的高清贴图。手工重建原资源后运行 `npm run assets:hd`，以恢复高清 PNG 和模型内嵌贴图。

## 无损压缩

`scripts/compress-hd-assets.py` 使用 Oxipng 10.2.1 的二级优化，以六路文件并行处理高清交付、田野路复用贴图、大厅和加载页背景、本地图标及角色缩略图。保持原尺寸、全部 RGBA 像素和色彩配置，包括全透明像素的 RGB。未使用调色板量化、透明像素颜色改写或有损缩放。原图片接口返回文件及低清原图备份保留。

全部高清资源采用 PNG 编码优化、模型贴图去重和下述绘画贴图颜色压缩。安装后的运行 PNG 由 4.309 GB 降至 3.310 GB，GLB 由 3.158 GB 降至 0.333 GB；运行图片、模型、地图选择预览及本地 Logo、光标和图标合计由 7.488 GB 降至 3.658 GB，节省约 3.830 GB（51.14%）。GB 按十进制统计，原版备份另行保留。

安装器让模型直接引用同目录下已安装的 PNG，跨目录的五处贴图保留内嵌。保留原视图编号，紧凑排列二进制视图，原内嵌图片的位置使用共用的四字节空视图；模型不再携带同目录 PNG 的重复图片字节。材质、UV、几何、动画和碰撞配置保留，非图片视图的内容逐字节一致。核对器按视图内容比较，允许打包偏移变化。未引用的原图片保留其内容。宠物模型从已下载的二进制加载，并使用其原始资源目录解析 PNG。

运行文件使用压缩版本，压缩前的高清版本单独保存在 `art/hd-assets/uncompressed/`。备份首次保存后不会被后续压缩覆盖；恢复命令同时还原交付文件与运行文件，备份仍保留。

```sh
python3 scripts/compress-hd-assets.py --oxipng /path/to/oxipng --workers 6
python3 scripts/compress-hd-assets.py --restore
```

Oxipng 可从 `https://github.com/oxipng/oxipng/releases/tag/v10.2.1` 下载。本流程只进行本地压缩、安装和资源核对，不调用图片接口。

## 绘画贴图颜色压缩

`scripts/compress-hd-painted-assets.py` 对大型绘画贴图的 RGB 使用 64 级通道精度，保留 8 位 PNG 文件格式、高清尺寸和完整透明通道。相对原高清备份，每个 RGB 通道的最大差异为 2/255，色彩配置一致，全透明像素的 RGB 也保持原值。256 色以内的简单图片保持原像素；所有 UI、文字、普通字体延期资源和界面布局均不参与颜色压缩。

按 PNG 体积从大到小处理，达到相对原运行资源至少 51% 的缩减后停止新增处理，剩余贴图保留完整原颜色精度。原版高清文件继续保存在 `art/hd-assets/uncompressed/`，恢复命令同时还原交付与运行文件。

实际处理 118 份大型绘画贴图，均通过 RGB 最大差异 2/255、透明度、尺寸和色彩配置核对。其余贴图保持原像素。7552 个交付图片路径及 956 个已替换模型的资源核对通过，几何、UV 和动画数据一致。

```sh
python3 scripts/compress-hd-painted-assets.py --oxipng /path/to/oxipng --workers 6
python3 scripts/compress-hd-assets.py --restore
```

`art/hd-assets/painted-compression.json` 记录逐图颜色误差、透明度与尺寸核对、运行图片及模型核对和最终体积；对照图位于 `art/hd-assets/previews/compression-comparison.png`。
