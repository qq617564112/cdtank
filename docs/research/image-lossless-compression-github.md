# 项目图片资产的无损体积优化

核对日期：2026-10-12。当前项目以 Oxipng 优化 PNG 为主，WebP 使用 libwebp，GIF 使用 Gifsicle，保留原格式、路径、尺寸和图像数据。JPEG 可采用 Jpegoptim。

## 当前项目适配

运行目录 `apps/web/public/` 共 5169 个图片文件、7,028,931,212 bytes；其中 PNG 为 4851 个、6,994,025,054 bytes，约占图片体积的 99.5%。高清源目录 `art/hd/` 共 5514 个图片文件、7,136,713,141 bytes，格式如下。

| 格式 | 文件数 | 体积（bytes） | 处理方案 |
| --- | ---: | ---: | --- |
| PNG | 5190 | 7,100,063,507 | Oxipng，无损优化原 PNG |
| WebP | 290 | 34,827,088 | libwebp 严格无损重编码，采用较小结果 |
| GIF | 6 | 1,743,476 | Gifsicle，无损优化动画编码 |
| SVG | 27 | 75,808 | 保留原文件 |
| ICO | 1 | 3,262 | 保留原文件 |

PNG 占高清图片体积的 99.5%。SVG 与 ICO 合计约 79 KB，压缩收益很小。运行目录的 290 个 WebP 全部为静态图片，其中 262 个使用 VP8L 无损编码，28 个使用 VP8 有损编码。

优化应从 `art/hd/` 进入已有发布流程，再更新运行资源。`art/original/` 是原始档案；项目文档要求保留其原尺寸和文件内容。目录用途与发布流程来源：[运行美术资源](../original-assets.md)。

盘点包含 Git 忽略的资源，排除依赖与 Git 内部文件。完整工作区还有历史备份、生成中间文件和恢复来源，合计 66055 个图片文件、51,707,425,816 bytes；这一数字不代表上线包体积。上述数量和体积来自本地文件清点，WebP 编码类型来自 RIFF 容器的 VP8L、VP8 与 ANIM 标记。

## GitHub 命令行工具

### Oxipng：PNG 主方案

[Oxipng](https://github.com/oxipng/oxipng) 是多线程 PNG/APNG 无损压缩优化工具，同时提供 CLI 和 Rust 库。默认优化等级为 `-o 2`；`-o 4` 可用于较充分的批处理。Windows 可下载 GitHub Releases，macOS/Linux 可使用发行版包管理器，另可用 `cargo install oxipng` 安装。最新核对发布为 [v10.2.1](https://github.com/oxipng/oxipng/releases/tag/v10.2.1)，发布页 feed 日期为 2026-09-02。

单文件候选命令：

```sh
oxipng -o 4 --out output.png input.png
```

此命令保留原始输入，输出 PNG，不改变尺寸，不启用修改完全透明像素 RGB 的 `--alpha` 或强制降位深的 `--scale16`。默认会尝试可无损执行的位深、颜色类型、调色板等编码优化，并默认去除交错；这些属于编码表示变化。若要求这些表示也保持一致，可加 `--nx`，代价是减少优化空间。

默认未传 `--strip` 时保留仍然有效的 metadata chunks，包括 ICC/EXIF 等。

采用保留元数据的配置，不传 `--strip`。

默认不强制写入更大的输出。优化等级越高，收益通常越趋于递减；`-z` 可使用更慢的 Zopfli 压缩器，上游没有保证它一定优于默认压缩，不建议对全部资源直接采用最高耗时配置。

来源：[README：定位、安装、等级、透明像素与收益](https://github.com/oxipng/oxipng/blob/8bc87852c72da7473a971faa5711273e95a9b218/README.md)、[MANUAL：输出、元数据、无损变换、Zopfli 与较大输出规则](https://github.com/oxipng/oxipng/blob/8bc87852c72da7473a971faa5711273e95a9b218/MANUAL.txt)。

### Jpegoptim：JPEG 备选

[Jpegoptim](https://github.com/tjko/jpegoptim) 是 JPEG CLI 优化工具。默认采用无损优化；指定 `-m` / `--max` 或 `-S` / `--size` 会启用有损模式，不能将质量 100 当成严格无损替代。需要保留全部额外 markers 时，可明确使用 `--strip-none`，避免删除 EXIF、ICC、XMP 等数据。

候选命令：

```sh
jpegoptim --strip-none photo.jpg
```

Jpegoptim 常规文件模式会直接处理原文件；项目正式应用前应通过既有资产副本/发布流程保留原始资源。上游 README 列出的平台包括 Linux、macOS 和 Windows，安装说明提供源码编译步骤，可连接 libjpeg、libjpeg-turbo 或 MozJPEG。核对的主分支 README 为 `v1.5.7beta`，记录日期 2026-09-15，包含 1.5.7 的修复工作，表明当前仍有维护。

来源：[README：平台、安装、依赖与维护记录](https://github.com/tjko/jpegoptim/blob/d62c174526cac4dbdbea687603b1f89c4a86c818/README)、[man page：无损与有损模式及 markers 参数](https://github.com/tjko/jpegoptim/blob/d62c174526cac4dbdbea687603b1f89c4a86c818/jpegoptim.1)。

### MozJPEG / jpegtran：JPEG 进一步优化候选

[MozJPEG](https://github.com/mozilla/mozjpeg) 提供渐进扫描优化，README 明确可以通过 `jpegtran` 对既有 JPEG 无损缩小体积。`jpegtran` 直接处理 DCT 系数，不做完整像素解码再重编码，因此不会增加图像降质。适合已有 JPEG 的编码优化；`cjpeg` 转换或重新编码图片是不同使用路径。

保留元数据的单文件候选：

```sh
jpegtran -copy all -optimize -progressive -outfile output.jpg input.jpg
```

`-copy all` 用于保留额外 markers；默认仅复制 comments，会丢弃其他元数据。该命令输出独立 JPEG 文件。核对最新 GitHub 发布为 [v4.1.5](https://github.com/mozilla/mozjpeg/releases/tag/v4.1.5)，feed 日期为 2023-10-12；发布间隔较长，不能仅凭它把该工具判定为不再维护。项目 PNG 占比极高，当前无需先投入这条路线。

来源：[README：jpegtran 无损扫描优化及库定位](https://github.com/mozilla/mozjpeg/blob/08265790774cd0714832c9e675522acbe5581437/README.md)、[usage.txt：DCT 系数、优化、progressive 与 metadata copy](https://github.com/mozilla/mozjpeg/blob/08265790774cd0714832c9e675522acbe5581437/usage.txt)、[jpegtran.c：CLI 参数与默认 metadata copy](https://github.com/mozilla/mozjpeg/blob/08265790774cd0714832c9e675522acbe5581437/jpegtran.c)。

## 其他现有格式

### libwebp：静态 WebP

[libwebp](https://github.com/webmproject/libwebp) 的 `cwebp` 支持读取现有静态 WebP。使用无损编码，保留完全透明区域的 RGB 值，并复制 EXIF、ICC、XMP：

```sh
cwebp -lossless -q 100 -m 6 -exact -metadata all input.webp -o output.webp
```

其中 `-exact` 保留完全透明像素的 RGB 值，`-metadata all` 复制受支持的元数据。项目这批 WebP 全部为静态图片，适用于此命令。批处理采用比输入更小的输出。

来源：[cwebp 官方手册：输入格式、无损编码、exact 和 metadata](https://github.com/webmproject/libwebp/blob/main/man/cwebp.1)。

### Gifsicle：GIF

[Gifsicle](https://github.com/kohler/gifsicle) 提供 GIF 动画编码优化，压缩变化区域并选择更小的表示：

```sh
gifsicle -O3 input.gif -o output.gif
```

该配置保留动画显示内容，不启用 `--lossy`、颜色数量缩减或缩放。批处理采用比输入更小的输出。

来源：[README：GIF 操作和动画优化](https://github.com/kohler/gifsicle/blob/master/README.md)、[官方手册：优化等级和 lossy 模式](https://github.com/kohler/gifsicle/blob/master/gifsicle.1)。

## 桌面工具

### Caesium Image Compressor

[Caesium](https://github.com/Lymphatus/caesium-image-compressor) 提供中文界面，支持 Windows、macOS、Linux，可批量处理 JPEG、PNG、WebP。Windows 有安装版和便携版，macOS 提供 DMG；Linux 的上游说明提供自行编译或第三方构建方案。

适合人工操作：勾选 **Lossless** 与 **Keep Metadata**，选择保留原格式与原尺寸。v2.8.5 的首次使用默认关闭 Lossless，JPEG/PNG 的质量默认值为 80，因此需要先设定无损模式。PNG 无损分支使用 Oxipng，JPEG 无损分支直接重写 DCT 系数。

来源：[README：格式、平台、安装与中文支持](https://github.com/Lymphatus/caesium-image-compressor/blob/183686b83c6335bb62216351b130e7b8b74ad98a/README.md)、[v2.8.5 界面选项](https://github.com/Lymphatus/caesium-image-compressor/blob/v2.8.5/views/MainWindow.ui#L886)、[v2.8.5 默认设置](https://github.com/Lymphatus/caesium-image-compressor/blob/v2.8.5/src/MainWindow.cpp#L391)、[JPEG 无损实现](https://github.com/Lymphatus/libcaesium/blob/master/src/jpeg.rs)、[PNG 无损实现](https://github.com/Lymphatus/libcaesium/blob/master/src/png.rs)。

### ImageOptim

[ImageOptim](https://github.com/ImageOptim/ImageOptim) 是 macOS 桌面工具，可拖入 PNG/JPEG 或目录，调用多种优化器并选择较小输出。官网下载页当前提供 1.9.3；下载入口以[官网](https://imageoptim.com/mac)为准。

使用时关闭 **Lossy minification**；需要保留元数据时，关闭 **Strip PNG metadata** 与 **Strip JPEG metadata**。其帮助文档说明 OxiPNG 与 Zopfli 会清理完全透明像素的 RGB；对要求精确保留这些值的游戏图片，单独使用上述 Oxipng CLI 更容易明确控制参数。

来源：[README：集成工具](https://github.com/ImageOptim/ImageOptim/blob/8a4651e14ca53022f6a318071d08bb132fc56ce9/README.md)、[偏好设置说明：有损开关、元数据、透明像素](https://github.com/ImageOptim/ImageOptim/blob/8a4651e14ca53022f6a318071d08bb132fc56ce9/imageoptim/en.lproj/Help/prefs.html)、[使用说明：拖入目录并选取较小文件](https://github.com/ImageOptim/ImageOptim/blob/8a4651e14ca53022f6a318071d08bb132fc56ce9/imageoptim/en.lproj/Help/index.html)。

## 限制

无损压缩不能承诺固定缩小百分比；已经充分优化的图片可能没有收益，个别编码方案也可能产生更大文件。既有有损 WebP 的信息不能通过后续无损编码恢复。无损在这里指图像数据保留，不代表整个文件字节或全部元数据字节不变：Oxipng 会移除因编码变换失效的 `bKGD`、`sBIT`、`hIST`，以及默认移除 `caBX`、`iDOT`；`--strip all` 会删除色彩等非关键 chunks，并将 APNG 转为静态 PNG。本文完成了仓库来源核对、格式与体积盘点，未运行项目图片压缩实测，实际节省量和耗时尚未测量。
