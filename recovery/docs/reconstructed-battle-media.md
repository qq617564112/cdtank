# 补作战斗媒体

原包缺失的纹理、环境声及特效树声音按现有消费者合同发布独立补作资源，provenance明确区分原资源与补作。

## m120 幽灵猫纹理

原 `Data/effect/effect/youlincat.POL` 是现有实体，单一 mesh 为 346 顶点、408 三角形、FVF19，仅引用缺失的 `m120.TGA`。`recovery/reconstruct_battle_media.py` 的 `export_m120(model_path, web_root)` 从同一 POL 的 XYZ、UV 和 15 个连通 UV 岛生成 256×256 RGBA 纹理，固定返回：

- `reconstructed/battle/m120.png`
- `reconstructed/battle/m120-preview.png`，四联离线预览，依次为纹理、UV 岛、正面模型投影、侧面模型投影

纹理按原模型的表面位置分区着色：头和身体为青白/淡紫、耳尖为淡紫、鼻为低饱和暗紫、眼球/瞳孔为暗蓝灰，高光随原法线；脚底和三处小表面使用相近低饱和色。没有棋盘、单色占位或把眼鼻投到背面的通用贴图。`M120_PROVENANCE` 标记 `kind='reconstructed'`，保留原模型路径和材质引用。`export_effect_models` 从 `reconstruct_battle_media` 调用 `export_m120`，并把其写入 `part.asset` 与 `part.textureProvenance`；原 POL 保持不变。

## BG07 环境声

原安装包、32 份补丁候选和 verified 提取物均没有 `BG07.wav` 实体。原 `Data/scn/0009/0009.obj`、`0015.obj` 各有一条 `SYcScnObjSound`，`0018.obj` 有 id57–62 六条；三图名称均为 `BG07`，均为 enabled、gain1、interval0、randomGate0、selector−1、spatial，原位置保持不改。

`export_bg07(web_root)` 输出 18 秒可循环资源：

- `reconstructed/battle/BG07.wav`
- 22050Hz、16-bit PCM、mono
- measured peak 0.1367、RMS 0.0380，低于现有 BG06/08/10/11/12 的常见峰值与整体声压，保留多 voice 同时播放余量
- seed1207，周期平滑滤波噪声叠加低频远处环境嗡鸣，首尾无长静音和单频正弦，不做尖锐冲击

该音色是补作选择，不声称原 BG07 的机器声内容已恢复。`export_audio.py` 在原 `CDTank/Data/sound` 和已验证列表中仍无 BG07 时调用此函数，把条目追加进 `sounds`，再按原 MusicString 生成 `soundIds`；原 ID177 因而成为现有 `MapEnvironmentSound` 可消费的同一 WAV 引用。原地图 0009/0015/0018 的 placement、默认音量和其它 WAV 字节保持。

## Type4 特效树声音

ww051补作已沿现Type4声音消费者发布，详[reconstructed-ww051-runtime.md](reconstructed-ww051-runtime.md)。落樱／霜雪ww101/ww102、新年／发财弹ww077/ww078/ww079/ww053、猛虎王死亡ww154及Castle041树声ww098共8个声音已独立补作并写入audio.json，详[reconstructed-tree-audio-runtime.md](reconstructed-tree-audio-runtime.md)。publisher先取原声音，同名缺失才调用补作；原节点请求次数、延迟、独立技能声音及清场保持。原内容与新增实际输出仍待完成。

复活保护037的ww137已补作发布，并在存活自然到期第二槽通知中沿现Type4消费者播放，详[reconstructed-ww137-runtime.md](reconstructed-ww137-runtime.md)与[respawn-protection-second-slot-gap.md](respawn-protection-second-slot-gap.md)。原触发时点／音频内容与新增实际输出保持开放。

## 边界

现有搜索结果继续把原实体命中与补作分开；`recovery/output/resource-search-missing` 不改。补作纹理/音频已生成到本 worktree 的 `recovery/output/web-assets`，不是原版本字节。未运行浏览器、构建、类型检查或音频人耳验收；原资源仍缺的事实、地图18原规则和完整地图表现不受本片影响。
