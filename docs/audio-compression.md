# 音频提取、压缩与发布

音频采用 `arts/audio/` → `arts/compressed-audio/` → `apps/web/public/assets/audio/`。原版 WAV 和 MP3 保存在源目录，压缩成品独立保存；发布只复制成品，不重新编码。图片继续使用 `art/hd/` 和 `art/compressed/`。

## 执行入口

准备原客户端 `CDTank/`、Python 3.10+、恢复工具依赖及带 libopus 的 FFmpeg：

```bash
python3 -m venv recovery/.venv
recovery/.venv/bin/python -m pip install -r tools/recovery/requirements.txt
sudo apt-get install ffmpeg

# 完整流程：提取 → 压缩 → 发布
npm run assets:audio

# 分步执行
npm run assets:audio:extract
npm run assets:compressed-audio
npm run assets:audio:publish
```

`assets:audio:extract` 直接读取 `CDTank/Data/music/music.cpk` 和 `CDTank/Data/sound/*.wav`，不依赖旧的 `recovery/output/verified/`。音乐按原字节提取；缺少原文件的 BG07、ww051 和树内声音沿用现有重建器，写为源 WAV。原客户端保持原样，原调用路径证据仍写入 `recovery/output/audio-events.json`。

源目录的 `audio.json` 记录原 MusicString、地图选曲、技能音效、默认音量与来源；实际文件按 `music/`、`sfx/` 分类，补作放在各自的 `reconstructed/`。清单中的 `assets/audio/` 前缀是发布地址，目录中的文件从 `music/` 或 `sfx/` 开始。

## 编码配方与增量更新

[配方](../scripts/audio_compression/recipe.json) 逐项记录源路径、输出路径、类别和编码方案：

| 方案 | 输入 | 输出 |
| --- | --- | --- |
| `keep-mp3` | 原 MP3 音乐 | 原字节复制，保留 `.mp3` |
| `opus-mono` | 单声道 PCM WAV | Ogg Opus，64 kbps VBR，`.opus` |
| `opus-stereo` | 双声道 PCM WAV | Ogg Opus，96 kbps VBR，`.opus` |

Opus 使用 libopus、复杂度 10、20 ms 帧和 audio 模式，编码输出采样率为 48 kHz。保留原声道，不归一化音量、不裁剪静音；22.05 kHz 源只在编码阶段重采样一次，不增加原始频带。每次从 `arts/audio/` 编码，已有 Opus 不作为下一次编码源。MP3 不做有损再编码。

新增素材先写入 `arts/audio/` 并登记源 `audio.json`，再更新配方；修改原版导出内容时先更新提取器。重新执行提取会从原客户端及重建器恢复对应的源文件，编辑后的素材需要自行保留创作源。

首次生成使用完整入口；后续可仅处理一个或多个配方路径：

```bash
npm run assets:compressed-audio -- --audio sfx/GA07.wav
npm run assets:audio:publish -- --audio sfx/GA07.opus

# 多文件可重复指定 --audio，源路径和输出路径均可
npm run assets:compressed-audio -- --audio sfx/GA07.wav --audio sfx/BG08.wav
npm run assets:audio:publish -- --audio sfx/GA07.opus --audio sfx/BG08.opus
```

修改全局编码设置或 profile 后执行完整压缩。压缩入口接受 `--source`、`--output`、`--recipe`、`--ffmpeg`；默认从 PATH 查找 FFmpeg，也可设置 `CDTANK_FFMPEG=/path/to/ffmpeg`。提取器接受 `--output`。发布入口接受 `--source`、`--output`，默认输出也支持 `CDTANK_WEB_ASSETS`。源目录与输出目录不能重叠。

## 发布清单与结果

压缩入口生成 `arts/compressed-audio/audio.json` 和 `reports/generated-audio.json`。报告记录编码器版本、逐文件源采样率、声道、时长、编码参数、源体积和成品体积；MP3 直接记录复制体积。

发布入口读取这份成品清单，将文件复制到 `public/assets/audio/{music,sfx}/`，写入 `public/manifests/audio.json`。`sounds`、`soundIds`、`battleFire` 和 `battleKill` 中的运行引用同步改为 Opus；地图选曲、声音 ID、默认音量和已有自定义地图追加的选曲记录保留。旧清单中被替换的 WAV 在新清单写出后移除。发布统计写入 `arts/compressed-audio/reports/published-audio.json`。

成品条目通过 `sourceAsset`、`sourceBytes` 与 `sourceFormat` 保留来源，`format`、`bytes` 和 `mimeType` 描述成品；有损输出的原始 SHA 字段改为 `sourceSha256`。Web Audio 按文件内容解码，继续复用原播放与循环逻辑；HTMLAudio 音乐仍使用原 MP3。

本批次由 FFmpeg 7.0.2 编码：

| 素材 | 数量 | 源字节 | 成品字节 | 减少 |
| --- | ---: | ---: | ---: | ---: |
| WAV → Opus | 185 | 25,423,528 | 3,456,988 | 86.40% |
| MP3 原样复制 | 14 | 24,485,292 | 24,485,292 | 0% |
| 合计 | 199 | 49,908,820 | 27,942,280 | 44.01% |

例如 `arts/audio/sfx/GA07.wav` → `arts/compressed-audio/sfx/GA07.opus` → `apps/web/public/assets/audio/sfx/GA07.opus`；原音乐 `arts/audio/music/GAM02.mp3` 沿同一路径层次复制到 public。

## 限制

体积为实际编码文件统计，未进行试听、浏览器验收或性能实测。原 WAV 的既有播放证据不等同于新 Opus 的验收；短促瞬态与环境循环接缝仍需试听。Ogg Opus 在 Apple 平台要求相应系统支持：WebKit 明确支持范围为 Safari 18.4 搭配 macOS Sequoia 15.4、iOS/iPadOS 18.4、visionOS 2.4 及后续版本，详见[官方发布说明](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)。

压缩减少下载和资源缓存体积；相同时长、声道与 AudioContext 采样率下，解码后的 AudioBuffer 内存不随源文件码率下降。原始音质与编码选择依据见[调研](recovery/audio-codec-research.md)。
