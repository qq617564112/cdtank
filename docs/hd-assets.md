# 高清贴图

图片生成与编辑统一使用 `/workspace/self-skills/chatgpt2api-image-api` 的 `gpt-image-2` 编辑接口，服务地址为 `https://gptimg.cloyd.fun/`。密钥从 `CHATGPT2API_AUTH_KEY` 或终端隐藏输入读取，不写入项目文件。

优先处理 21 款坦克的基础、炮塔、车身、履带及迷彩贴图与 10 只宠物；两类资源完成后按地图编号逐张处理，再完成其他美术、特效、图标与界面资源。运行资源及本地加载文字共 7776 个 PNG 路径。原运行目录的 7766 个路径按尺寸及 RGBA 像素去重后为 6041 份图像。已完成的田野路素材直接复用。

独立地图 `1002` 的 85 张高清贴图及地图预览也直接复用已确认的田野路交付，保留其现有高清尺寸。

每次宠物请求只包含一只宠物；坦克请求只包含同一款坦克的贴图。其他小素材、文字、数字和控件拼成图集后通过图片接口重绘，大型图集独立生成。保留原字形、图集布局与透明边缘。

界面中的坦克和宠物肖像从高清模型离线重绘，同时写入原 UI 区域和本地缩略图目录。这些肖像使用各角色单独生成的贴图，不再放进多角色 UI 拼图请求。

UI 按原图集家族分组。32 像素以内的细碎素材最多排 8×8，64 像素以内最多排 4×4，其余中型素材排 2×2；大型素材继续独立请求。未填满的批次也使用方形画幅，避免宽长拼图被图片接口压缩或加白边。宽长字体条按原字形目录拆成独立字符，每批最多 64 字，完成后按原始坐标还原字符条。

宽度超过 256、高度不超过 64 像素的水平 UI 横条按原家族纵向排列。每条保持 512 像素的请求宽度及原比例，在 528×528 方形画布中按实际高度填充，条间保留 16 像素间距；当前 74 条资源合并为 14 批请求。

字体请求以白字黑底呈现真实字形；返回的笔画与原字形透明轮廓配准后作为高清透明遮罩，保留原字符位置、字距和字形外侧空白。

加载页的十份进度文字纳入 UI 拼图请求，以原文字颜色和真实透明笔画铺在黑底上；返回笔画生成高清透明遮罩，安装器按清单的 `installPath` 替换本地图片。

原 UI 图集从已经完成的高清区域按原始坐标重新组装，避免把多个坦克或宠物作为整幅图集交给接口；其它空白区域沿用原布局。图集组装使用 `scripts/assemble-hd-ui-atlases.py`，输出同样纳入安装清单。

`size` 在此服务中是画幅比例提示，实际返回尺寸记录在调用账本。交付 PNG 按原尺寸的四倍保存；生成结果通过轮廓配准、局部色调校正与原透明遮罩保持 UV 图集位置。地图贴图保留更宽的原图边缘过渡，避免道路断口和草地色差。几何、UV、材质配置、碰撞及动画数据沿用原资源。

比例提示使用输入拼图的实际宽高比；两列一行的请求采用 2:1。

## 文件

- `art/hd-assets/inventory.json`：原路径、原图备份、高清 PNG 路径、共享素材及所属地图。
- `art/hd-assets/plan.json`：批次及处理顺序。
- `art/hd-assets/calls.json` 与 `pilot-call.json`：请求结果及实际返回尺寸。
- `art/hd-assets/batches/`：输入拼图、提示词和返回图片。
- `art/hd-assets/png/`：完成的高清 PNG。
- `art/hd-assets/original/` 与 `original-models/`：原图与模型备份。
- `art/hd-assets/previews/`：使用同一份原模型离线绘制的原图与高清图对照。
- `art/hd-ui/png/lobby/`：共用顶栏、底部剪影、目录板与连续玩家列表底图，以及本地组装的 4:3、16:9 大厅背景。
- `art/hd-local-ui/`：本地图标和标志的原图、两份请求输入及交付。标志单独请求，光标与应用图标共用两格图集。

## 使用

生成器需要 Pillow、numpy、opencv-python-headless，以及上述技能目录。安装器仅使用 Python 标准库，不调用图片 API。

```sh
python3 scripts/generate-hd-assets.py prepare
python3 scripts/pack-hd-ui-assets.py
python3 scripts/generate-hd-assets.py run --concurrency 4
python3 scripts/generate-hd-assets.py generate --groups tanks pets --concurrency 4
python3 scripts/generate-hd-assets.py generate --groups map-0001 --concurrency 4
python3 scripts/generate-hd-local-ui.py run
python3 scripts/generate-hd-ui-layouts.py run --group entry
npm run assets:hd
```

生成器跳过已交付贴图，记录失败请求；每个失败批次自失败时间起等待 300 秒后重试，其余独立批次继续生成。等待分成不超过 30 秒的片段。重新执行时复用已保存结果及每个批次的剩余等待时间。`--limit` 可设置累计提交上限。`run` 按组生成、安装并绘制模型与地图预览，同时替换本地角色缩略图与小地图图标。

恢复 UI 生成时，已齐全的字符图块先按原坐标拼装为字体条，再跳过相应请求批次；尚未返回的字符继续生成。

当服务返回 `insufficient_quota`，所有新请求等待五分钟，随后以单个请求尝试恢复；成功后继续原并发数。

`scripts/generate-hd-ui-layouts.py` 分别重绘大厅上半部蓝色顶栏、下半部剪影和独立目录板。4:3 与 16:9 共用同一套图案：顶栏保留两端装饰，中间蓝色空白带按宽度延展；底部剪影使用同一张宽屏素材，4:3 取中央原稿区域。目录板与玩家列表作为独立图层摆放，控件由界面组件叠加。运行 `python3 scripts/generate-hd-ui-layouts.py assemble` 可重组布局，不再次调用图片接口。

登录页同样从上下两份共用部件组装：4:3 取中央原图区域，16:9 增加两侧背景；表单和按钮随整个内容层居中，保持原逻辑坐标。频道选择页使用同一组框架部件居中排列，遮罩延展到舞台宽度。背包和商店保留居中弹窗及共用分块图案。高清光标用 4x 图像密度显示，热点仍为 2,4，逻辑尺寸仍为 32 像素；应用图标提供 16 至 256 像素的七种尺寸。

`assets:install` 解压原资源后安装已经完成的高清贴图。手工重建原资源后运行 `npm run assets:hd`，以恢复高清 PNG 和模型内嵌贴图。
