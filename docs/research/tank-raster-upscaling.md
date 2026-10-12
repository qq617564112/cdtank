# 坦克原版贴图的位图放大

001 的车身 M、炮塔 U 原图为 256×256、不透明 RGBA。已用 Waifu2x 和 Real-CUGAN 的官方发布包做四倍放大，每种设置输出独立的 1024×1024 PNG；另有 Lanczos 插值基准。完整画布按相同比例缩放，原始素材保存在 `art/original/`。

## 实际样本

| 方案 | 设置 | 本次局部图片观察 |
| --- | --- | --- |
| Waifu2x CUNet | `-n -1`，连续两次原生 2× | 细节较清晰，圆环外缘、孔边和五边形边缘有波纹 |
| Real-CUGAN SE 保守版 | `-n -1 -s 4` | 迷彩分布、五边形倒角、圆孔、灯罩格线保留，格栅和舱门细节较柔和 |
| Real-CUGAN SE 不去噪版 | `-n 0 -s 4` | 格栅、灯罩和舱门细线更清晰；部分边缘的对比和锐度提高 |
| Pillow Lanczos | `Image.Resampling.LANCZOS`，4× | 保留低分辨率图案，锯齿和模糊仍可见 |
| SwinIR 经典超分 | DF2K、64 px 训练窗口、原生 4×，PyTorch CPU | 细小暗孔仍可区分，倒角边框更硬，原图的像素块和锯齿被强化 |
| Real-ESRGAN 动漫 6B | `RealESRGAN_x4plus_anime_6B.pth`，原生 4×，PyTorch CPU | 迷彩和线条清晰，盖板部分直线保留；下部装甲小块的边缘有波纹、局部偏色 |
| Real-ESRGAN 动漫视频 v3 | `realesr-animevideov3.pth`，原生 4×，PyTorch CPU | 边缘较柔和，盖板条状边框可见，小块外形较规整但内部细节仍模糊 |

优先审计 Real-CUGAN 不去噪版与保守版：前者偏向清晰线条，后者偏向柔和过渡。这是对 001 两张图片的观察，不是全部坦克的效果结论。

- [不去噪版查看器](http://192.168.10.140:40175/tank.html?tank=1&skin=upscale-cugan-nodenoise&tracks=0)
- [保守版查看器](http://192.168.10.140:40175/tank.html?tank=1&skin=upscale-cugan-conservative&tracks=0)
- [Waifu2x 查看器](http://192.168.10.140:40175/tank.html?tank=1&skin=upscale-waifu2x&tracks=0)
- [原版查看器](http://192.168.10.140:40175/tank.html?tank=1&skin=vector-original&tracks=0)
- [SwinIR 经典超分查看器](http://192.168.10.140:40175/tank.html?tank=1&skin=upscale-swinir-classical&tracks=0)
- [Real-ESRGAN 动漫 6B 查看器](http://192.168.10.140:40175/tank.html?tank=1&skin=upscale-esrgan-anime6b&tracks=0)
- [Real-ESRGAN 动漫视频 v3 查看器](http://192.168.10.140:40175/tank.html?tank=1&skin=upscale-esrgan-animevideo&tracks=0)

查看器保持均匀白色环境光，切换同车型贴图时保持相机姿态。`output/upscale/tank-001/` 保存 PNG、绘制对照图的脚本、执行命令、版本与耗时；运行图片位于 `apps/web/public/tank-audit/upscale-*/`。

## GitHub 方案与原始来源

### Waifu2x

[waifu2x-ncnn-vulkan](https://github.com/nihui/waifu2x-ncnn-vulkan) 提供含模型的 Linux、Windows、macOS 发布包，`-g -1` 选择 CPU，`-n -1` 选择 `scale2.0x_model` 纯放大模型。本次使用 20220728 包、CUNet 模型，先把完全不透明的原图转成 RGB，再执行两次 2×。源码明确按 2× 模型反复处理高倍率，因此 4× 不是独立训练的 4× 模型。

来源：[README 与 CLI 参数](https://github.com/nihui/waifu2x-ncnn-vulkan/blob/93ed2bc36e6fb7d0c42d1034f3617bc62d35f9cd/README.md)、[倍率处理与模型选择](https://github.com/nihui/waifu2x-ncnn-vulkan/blob/93ed2bc36e6fb7d0c42d1034f3617bc62d35f9cd/src/main.cpp)、[MIT 许可](https://github.com/nihui/waifu2x-ncnn-vulkan/blob/93ed2bc36e6fb7d0c42d1034f3617bc62d35f9cd/LICENSE)。

### Real-CUGAN

[realcugan-ncnn-vulkan](https://github.com/nihui/realcugan-ncnn-vulkan) 提供同样的便携发布包和 CPU 模式。本次使用 20220728 的 `models-se` 原生 4× 模型。源码中 `-n -1` 选择 `up4x-conservative`，`-n 0` 选择 `up4x-no-denoise`；不能将两个工具的噪声参数当成相同含义。命令使用 `-c 1 -t 256`，主 RGB 图像按完整 256×256 输入处理。

上游将保守版用于担心纹理、画风、颜色被改变的素材；无降噪版用于原图噪声较少、希望提升清晰度的素材。

来源：[模型文件选择](https://github.com/nihui/realcugan-ncnn-vulkan/blob/395302c5c70f1bff604c974e92e0a87e45c9f9ee/src/main.cpp)、[发布工具说明](https://github.com/nihui/realcugan-ncnn-vulkan/blob/395302c5c70f1bff604c974e92e0a87e45c9f9ee/README.md)、[上游模型分类与强度说明](https://github.com/bilibili/ailab/blob/2799af78ef105b414cc4b796c67c8511acdcdf6f/Real-CUGAN/README.md)、[便携工具 MIT 许可](https://github.com/nihui/realcugan-ncnn-vulkan/blob/395302c5c70f1bff604c974e92e0a87e45c9f9ee/LICENSE)。

### SwinIR

[SwinIR](https://github.com/JingyunLiang/SwinIR) 提供经典、轻量和真实图像超分模型。经典与轻量模型的使用示例针对 bicubic 缩小的数据；它们可作为不同于动漫专用模型的后续候选。官方脚本在没有 CUDA 时使用 CPU，提供原生 2×、3×、4× 等权重。选择 `classical_sr` 或 `lightweight_sr` 时需与对应权重配套，不能混用 `real_sr` 的 GAN 权重。

本次执行了 `001_classicalSR_DF2K_s64w8_SwinIR-M_x4.pth`，分别处理 001 M/U 的完整原图，输出 1024×1024。采用官方 `SwinIR` 类和 `classical_sr` 参数，按官方脚本镜像补齐 8 px 窗口，裁去补齐的输出边缘。CPU 使用 6 个线程，M/U 耗时约 39.6/24.0 秒。原图为 RGB，不做颜色、轮廓或 UV 修正。

来源：[模型类别与使用命令](https://github.com/JingyunLiang/SwinIR/blob/6545850fbf8df298df73d81f3e8cba638787c8bd/README.md)、[CPU 选择、模型定义与输入处理](https://github.com/JingyunLiang/SwinIR/blob/6545850fbf8df298df73d81f3e8cba638787c8bd/main_test_swinir.py)、[Apache 2.0 许可](https://github.com/JingyunLiang/SwinIR/blob/6545850fbf8df298df73d81f3e8cba638787c8bd/LICENSE)。

### Real-ESRGAN

[Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) 有动漫专用 `RealESRGAN_x4plus_anime_6B` 模型及便携 NCNN 版本。官方介绍以视觉修复为目标，包含 GAN 路线；对要求严格保持轮廓的贴图仍需要逐图对比。任意 `--outscale` 是模型结果后接 Lanczos 重采样，不能把任意输出像素尺寸等同于原生恢复能力。

本次使用官方 PyTorch 权重分别处理 001 M/U 完整原图：动漫 6B 采用 `RRDBNet`，64 个特征通道、6 个 RRDB、32 个增长通道、原生 4×；动漫视频 v3 采用 `SRVGGNetCompact`，64 个特征通道、16 层卷积、PReLU、原生 4×。加载官方状态字典，使用 CPU 和 6 个线程，不切块推理。两种模型的 M/U 耗时分别约 6.8/4.3 秒、0.7/0.6 秒。结果均为 1024×1024，未局部替换细节。

来源：[动漫模型与命令](https://github.com/xinntao/Real-ESRGAN/blob/a4abfb2979a7bbff3f69f58f58ae324608821e27/docs/anime_model.md)、[功能与输出倍率说明](https://github.com/xinntao/Real-ESRGAN/blob/a4abfb2979a7bbff3f69f58f58ae324608821e27/README.md)、[BSD 3-Clause 许可](https://github.com/xinntao/Real-ESRGAN/blob/a4abfb2979a7bbff3f69f58f58ae324608821e27/LICENSE)。

网络原始定义：[RRDBNet](https://github.com/XPixelGroup/BasicSR/blob/651835a1b9d38dbbdaf45750f56906be2364f01a/basicsr/archs/rrdbnet_arch.py)、[SRVGGNetCompact](https://github.com/xinntao/Real-ESRGAN/blob/a4abfb2979a7bbff3f69f58f58ae324608821e27/realesrgan/archs/srvgg_arch.py)。权重：[动漫 6B](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth)、[动漫视频 v3](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-animevideov3.pth)。

`output/upscale/tank-001/other_models.py` 保存三种模型的实际推理过程，`other-models-manifest.json` 记录权重、源代码版本、参数、路径和耗时。`other-models-comparison.jpg` 对照完整图集，`other-models-detail.jpg` 对照截图指出的盖板及下部装甲小块。

### Anime4K / Anime4KCPP

[Anime4K](https://github.com/bloc97/Anime4K) 主要提供实时视频放大着色器，README 的主要优化对象是原生 1080p 动漫；不能直接将该定位套用到 256×256 UV 图集。[Anime4KCPP v3](https://github.com/TianZerL/Anime4KCPP) 则是 CNN 图片放大实现，带 CLI、CPU 与 GPU 后端，可作为另一个动漫图片候选。二者当前实现与应用定位有区别。

本次核对了源码说明，未执行这两套工具。

来源：[Anime4K 定位与低分辨率说明](https://github.com/bloc97/Anime4K/blob/7684e9586f8dcc738af08a1cdceb024cc184f426/README.md)、[Anime4KCPP v3 的算法、CLI 与许可](https://github.com/TianZerL/Anime4KCPP/blob/fe187e020c8e57c6885511344a8705c292a92612/readme.md)。Anime4KCPP 非视频模块采用 MIT，视频模块及链接它的模块采用 GPLv3。

## 限制

超分模型根据已有像素估计新像素，不能保证恢复原图已经丢失的设计细节；关闭去噪也不会使网络变成像素恒等变换。PNG 无损编码只保证保存时不再损失输出图像。若要求原始颜色逐像素保留，可以用整数倍最近邻复制像素，但锯齿仍然存在。

样本已检查贴图与局部对照，查看器和相关图片可通过 HTTP 获取。未运行单元测试、构建、类型检查或浏览器验收；3D 外观由查看器供人工审计。
