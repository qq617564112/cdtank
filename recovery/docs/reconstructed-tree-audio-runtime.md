# 正常战斗特效树补作声音运行时

`recovery/reconstruct_battle_media.py`的`TREE_SOUND_PROFILES`覆盖035/036、023/024、006、041与复活保护037正常入口引用的9个补作声音名。它们是以固定随机种子生成的补作WAV，不是原CDTank音频恢复，也不使用其它原声音代替。

| 用途 | 名称 | 时长 | seed | peak | rms | 合成特征 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 035/036闪光层 | ww101 | 0.52s | 10107 | 0.100833 | 0.032000 | 两段轻柔花瓣闪光叠加细碎风声 |
| 035/036雪雾层 | ww102 | 0.58s | 10211 | 0.103610 | 0.030000 | 下降晶体泛音叠加高频雪雾 |
| 023/024礼花升音 | ww077 | 0.38s | 7707 | 0.067751 | 0.038000 | 短促上升哨音与轻气尾 |
| 023/024礼花爆裂 | ww078 | 0.46s | 7807 | 0.179998 | 0.033924 | 紧凑噪声爆裂与低频 pop |
| 023/024礼花星屑 | ww079 | 0.62s | 7907 | 0.129521 | 0.027000 | 稀疏高频颗粒云 |
| 024金币延迟 | ww053 | 0.42s | 5307 | 0.126347 | 0.028000 | 短金币铃声与轻双击 |
| 006猛虎王死亡 | ww154 | 0.78s | 15407 | 0.178289 | 0.040000 | 低沉冲击主体与受限衰减尾 |
| 041城堡低血／死亡 | ww098 | 0.46s | 9807 | 0.059359 | 0.015000 | 安静碎石冲击与稀疏碎屑敲击 |
| 037复活保护自然到期 | ww137 | 0.42s | 13707 | 0.136998 | 0.032000 | 下降电子光闪与柔和气流退场 |

035/036均在延迟0秒请求ww101、延迟1.5秒请求ww102。024的ww053节点2837/2838/2839延迟分别为0、0.6000000238418579、1.2000000476837158秒。041低血给root、死亡给五个spout，各创建同一树，因此ww098按单voice控制为peak 0.059359、rms 0.015000，为五路叠加保留余量。

ww137复活保护第二槽声音已发布，采用0.42秒下降电子光闪与柔和气流，详细参数见[reconstructed-ww137-runtime.md](reconstructed-ww137-runtime.md)。该声音使用同一export_tree_sounds与Type4消费者。

## 发布约定

9个文件均为22050Hz、16bit、单声道PCM WAV，首尾样本归零，`style.loop=false`，时长0.38至0.78秒。总体峰值上限为0.18，RMS不高于0.040；每个profile固定seed、RMS目标与峰值上限，写盘后由实际PCM计算目录中的peak/rms。

`recovery/export_audio.py`先复制`CDTank/Data/sound/*.wav`的真实原字节，再保留现有BG07和ww051补作逻辑，最后调用`export_tree_sounds(OUT, existing_names)`。定向exporter遍历上述9个profile，并在名称不区分大小写地存在于已发布`sounds`时跳过写盘；`audio.json`只向`sounds`追加缺失条目，原有声音、soundIds、music、事件字段或其它字段保持。

定向发布入口为直接import `recovery/reconstruct_battle_media.py`的`export_tree_sounds`，传入现已发布名称，只生成缺失WAV并追加`recovery/output/web-assets/audio.json`。表内9个WAV及目录条目已发布。

## 当前消费者

`EffectRuntimeTree`把原四号类型节点构造成`EffectSoundNodeState`。节点开始时调用`EffectSound.play(reference, parameter)`；`EffectSound.configure`按名称小写建立`audio.json.sounds`目录，命中后创建HTMLAudioElement，并为`ended`与`error`接回结束清理。

当前节点的`stopPrevious=false`，生命周期结束时`additionalEnd`会调用`EffectSound.stop`；未到生命周期而媒体自然结束时，`EffectSound.finished`允许树节点结束。运行更新会移除已结束voice，实例释放、运行停止与整体清理继续沿现有`stop`/`clear`路径回收媒体源。该接线沿用现有Type4解析和EffectSound行为，没有新增消费者或并行音频框架。

## 限制

这些声音是项目采用的短效补作，只按用途、参数和实际PCM统计发布；当前没有听感验收、播放验收、浏览器链路复测或端到端声音生命周期实测。文档中的消费者行为来自现有源码，不能替代后续实际运行证据。
