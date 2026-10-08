# ww051 Type4 补作与运行合同

原 `Effect106/108/110/113` 等 12 个 Type4 源节点引用 `ww051`。原声音入口按该引用直接构造 `data\sound/ww051.wav`，不经过 MusicString 或别名；原文件、原 WAV 目录及 data/music 归档中均无实体。已有 native 证据继续记录原缺文件行为：无效播放描述符、`finished=true`、stop 不触达设备。本轮不修改该原合同证据，也不改写原 CDTank 资源。

`recovery/reconstruct_battle_media.py` 的 `export_ww051(out)` 在 `reconstructed/battle/ww051.wav` 发布独立补作：

- 0.45 秒、22050Hz、16-bit PCM、mono。
- seed5107；540→1720Hz 上扬电子啁啾叠加短气流噪声。
- 包络首尾归零，样本峰值0.165960、RMS0.052000；目标 RMS0.052，峰值上限0.24，避免削波。
- 仅使用现有 Python `math`、`random`、`wave` 和 `array`；不增加音频库、依赖或哈希。

返回条目以 `name='ww051'`、`resolution='reconstructed'` 和 `provenance.kind='reconstructed'` 标记补作来源，并附格式、时长、seed、样本峰值与 RMS。`recovery/export_audio.py` 先发布原 `CDTank/Data/sound/*.wav`；只有目录中没有大小写等价的 `ww051` 条目时才追加该补作，因此原文件一旦存在仍优先使用原字节。其它原 WAV、BG07 补作及独立 `SE*` 技能声音不变。

## 运行结果

集成后的 `audio.json` 将 Type4 的 `ww051` 引用解析为 reconstructed WAV。`EffectSound` 已按 name 大小写无关查表并消费 asset、音量、ended 和 clear；无需修改 Web 声音后端或 Type4 生命周期消费者。0.45 秒媒体开始播放后，Type4 的完成查询保持未完成；浏览器 `ended`（或加载失败）后该 voice 完成，节点随后按既有 stop/end 路径清理。共享清场仍会暂停、移除媒体源并复位 descriptor。

原缺文件时的 `finished=true` 行为仍是有效的原来源证据，但集成后不再代表该项目选择发布的运行路径。补作是明确标记的音色选择，不声称与原 ww051 音频等价，也不把补作算作原资源搜索命中。

## 限制

未运行测试、浏览器、构建或类型检查；设备音频播放、人耳音色、Type4 在 0.45 秒内的实际时序、音量混音和清场均待集成后实测。补作满足命名、格式与运行解析合同，不代表原资源恢复或整体特效保真验收完成。
