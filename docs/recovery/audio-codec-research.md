# 旧客户端音频的现代压缩选择

调研日期：2026-10-15。结论：优先考虑将现有 PCM WAV 发布为 Opus，以降低下载与资源缓存体积；已有 MP3 保留。压缩能以较少数据保留可接受听感，不能补回旧素材已经丢失的细节，也不能据此承诺帧率、播放缓存内存或音质提升。[1][2]

## 当前资源与加载方式

- `apps/web/public/assets/audio/` 有 185 个 WAV，合计 25,423,528 字节（24.25 MiB）：184 个音效和 `music/reconstructed/BG07.wav`。RIFF 头均为 PCM、16 bit、22,050 Hz；106 个单声道、79 个双声道，总时长约 374.50 秒。
- 14 个 MP3 合计 24,485,292 字节（23.35 MiB）；各文件首个音频帧均为 128 kbps、44.1 kHz、双声道，这不等于已验证整文件恒定码率。
- [audio-resources.ts](../../apps/web/src/audio/audio-resources.ts) 完整读取缓存 Blob，再经 `decodeAudioData()` 解码为 `AudioBuffer`，保存在全局 Map；地图循环等调用 `releaseAudioBuffer()` 清理。
- [battle-music.ts](../../apps/web/src/audio/battle-music.ts) 先等待完整 Blob，再交给 HTMLAudio；构造 Blob 的 MIME 为 `audio/mpeg`，改格式时需要同步更新资源引用和 MIME。

## 格式选择

| 输入或用途 | 建议 | 依据与取舍 |
| --- | --- | --- |
| PCM WAV 音效 | Opus VBR：单声道 48–64 kbps，双声道 64–96 kbps，作为试听起点 | 属于本项目选取的起始参数，爆炸、金属瞬态、尾音与循环接缝仍需逐类试听。Opus 同时面向语音和复杂音频。[1][3] |
| 较长环境音、音乐的无损源 | Opus VBR 96–128 kbps 双声道起步；环境音可向 64–96 kbps 比较 | Xiph 将音乐流建议为 64–96 kbps、音乐存储建议为 96–128 kbps；并要求通过听音调整，不能将该范围当作所有素材透明的保证。[3] |
| 语音的无损源 | 单声道 Opus 24–32 kbps 起步 | Xiph 为有声书/播客给出单声道 24 kbps；含尖叫、唱声或混合音效时提高码率并按复杂音频评估。[3] |
| 当前 128 kbps MP3 | 保留，除非逐项比较证明再次压缩值得 | MP3→Opus 属于有损再编码，不能提高相对输入的保真度，可能叠加失真；相近目标码率的体积收益有限。[2] |
| 必须逐采样保留的 WAV | FLAC | 对输入 PCM 无损，解码逐位一致；压缩后多大由实际内容决定，不预设节省比例。[4] |

当前 WAV 原始数据率为单声道 352.8 kbps、双声道 705.6 kbps。按实际时长，以单声道 48/双声道 80 kbps 和单声道 64/双声道 96 kbps 两组参数计算，编码载荷约 2.91–3.63 MiB，供资源预算采用约 3–4 MiB 的量级。它不是编码结果：容器、短文件开销及 VBR 波动另计；`opusenc` 的 VBR 目标也按大量多样音频的平均码率定义。[5]

保留提取源与无损中间源，发布格式始终从该源生成。22.05 kHz 原素材的有效频带不会因转为 48 kHz Opus 或提高采样率而扩展。[1][2]

## 性能影响

`AudioBuffer` 存放非交错 32 位浮点 PCM；`decodeAudioData()` 会重采样到 AudioContext 的采样率。[6][7] 同时长、声道数和输出采样率下，WAV、MP3、Opus 解码后的采样数据内存相同：

`PCM 字节数 = 秒数 × AudioContext 采样率 × 声道数 × 4`

例如现有 `BG08.wav` 为 25.495 秒双声道，文件约 2.14 MiB；在 48 kHz Context 下，其采样数据约 9.34 MiB，尚不含对象与其它缓存。这个数是单项计算，不代表实际同时驻留的音频总量。Opus 减少下载和压缩 Blob 体积，但相对 PCM WAV 增加编解码工作，不能直接推导 CPU、帧率或首次可播放时间一定改善。已解码音效的调度、混音与播放性能不因源文件码率降低而自动改善。[6][7]

长音乐使用 HTMLAudio 有利于避免把整曲放入应用持有的 AudioBuffer；当前代码仍先下载完整 Blob，所以换 Opus 本身不会变成边下边播。内存与启动等待若是目标，需要分别处理缓存生命周期和音乐加载方式。[6]

## 浏览器与容器

Opus 是编码格式，Ogg/WebM 是容器；不能仅凭“支持 Opus”或 WebRTC 支持判断文件播放能力。[1][2] WebKit 的 Safari 15 发布说明已有 WebM Opus 支持；Safari 17.0 说明进一步明确 macOS Sonoma 支持单、双声道 WebM/MP4 Opus。[8][9]

Ogg Opus 在 Apple 平台的明确新增范围是 Safari 18.4 搭配 macOS Sequoia 15.4、iOS/iPadOS 18.4、visionOS 2.4；不能只判断 Safari 版本而忽略操作系统。`opusenc` 默认输出 Ogg Opus（常见扩展名 `.opus`），不会因改扩展名而变成 WebM。实际采用哪种容器应按项目最低浏览器范围确定，并覆盖 `decodeAudioData` 音效和 HTMLAudio 音乐两条使用路径。[5][10]

## 证据范围

项目数据来自文件数量、字节数、RIFF/MP3 帧头及加载代码的只读核对；未编码、未试听、未做浏览器验收或性能实测。3–4 MiB 是码率预算，不是已实现节省。本文不声称压缩能增强原录音音质，或已验证所有短音效、循环与目标浏览器。

## 一手来源

以下资料均于 2026-10-15 查阅。

1. [Opus 官方特性](https://opus-codec.org/)；[IETF RFC 6716 §2：Opus 定义与带宽](https://www.rfc-editor.org/rfc/rfc6716#section-2)。
2. [MDN：Web audio codec guide，有损重压缩与格式选择](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs)。其 Safari 总表中的旧 CAF 说明未覆盖后续变化，Apple 容器版本以 WebKit 发布说明为准。
3. [Xiph：Opus Recommended Settings](https://wiki.xiph.org/Opus_Recommended_Settings#Recommended_Bitrates)。
4. [Xiph：FLAC features，无损与解码特性](https://xiph.org/flac/features.html)。
5. [Opus 官方 opusenc 手册：Ogg 输出、VBR 与目标码率](https://opus-codec.org/docs/opus-tools/opusenc.html)。
6. [MDN：AudioBuffer 的存储格式与长音频建议](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)。
7. [MDN：decodeAudioData 的完整文件要求及重采样](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)。
8. [WebKit：Safari 15 的 WebM Opus 支持](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/)。
9. [WebKit：Safari 17.0 的 macOS Sonoma Opus 支持](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)。
10. [WebKit：Safari 18.4 的 Ogg 支持及系统范围](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)；[Apple Safari 18.4 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes)。
