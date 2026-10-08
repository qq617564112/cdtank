# 复活保护第二槽与ww137补作

## 生产通知合同

`apps/server/src/battle/respawn-protection.ts`保留现5秒复活保护：真实复活完成后由
`applyRespawnProtection`最多授予一次，原`index0`首槽继续发送
`duration=5`，重复调用不刷新期限；独立item8状态及其首槽不变。

五秒保护存活自然到期且`combat.status===2`时，`advanceRespawnProtection`先删除
authority state，再发送一次`respawnProtectionEnded`并追加第二槽
`playSkillEffect={skillId:30001,effectIndex:1,duration:0,roleId:Number(player.id.slice(1)),xBits:0,zBits:0}`。
删除发生在消息构造前，因此后续重复advance不会重播。死亡、显式clear、finish、
round/loading和Leave只清理；这些路径不发送第二槽，clear也不增加stop消息、计时器、
效果队列或新event type。原server的第二槽触发时刻没有恢复，本实现明确采用上述
自然到期合同。

## ww137补作资源

技能30001的Effect37引用ww137。原工作集没有该WAV，因此采用
`recovery/reconstruct_battle_media.py`中的专用补作生成器，不复制或改名其它原声音，
也不使用静音占位。补作由`_ww137_pcm`分层生成下降电子光闪与柔和气流退场，并复用
`_tree_envelope`、`_tree_noise`、`_scale_tree_signal`和`export_tree_sounds`的
实际PCM写盘与统计。

| 参数 | 值 |
| --- | --- |
| asset | `reconstructed/battle/ww137.wav` |
| duration | 0.42s |
| seed | 13707 |
| sample rate | 22050Hz |
| channels / bits | 1 / 16-bit PCM |
| frames | 9261 |
| file bytes | 18566 |
| first / last PCM | 0 / 0 |
| actual peak | 0.136998 |
| actual RMS | 0.032000 |
| loop | false |
| target RMS / peak cap | 0.032 / 0.16 |

`recovery/output/web-assets/audio.json`只向现`sounds`追加该补作条目，原条目及
`soundIds`、music、maps、事件字段均保持。发布继续由`export_audio.py`的现有调用
链完成：先复制原声音，再把已发布名称传入`export_tree_sounds`；因此原同名WAV
按大小写不敏感优先，只有缺失时才生成或追加补作。

## 效果树节点

Effect37的源树节点为2547：

| node | reference | delay | parameter | stopPrevious |
| ---: | --- | ---: | ---: | --- |
| 2547 | ww137 | 0.0 | 0 | false |

`recovery/effect_sound_controls.py`从Type4节点resource的324字节reference、u32
parameter和stopPrevious字节取得上述字段。`EffectRuntimeTree`据该节点构造
`EffectSoundNodeState`；节点启动后首次update调用`EffectSound.play("ww137",0)`，
此后不重播。`stopPrevious=false`，所以新播放不会停止共享的上一条voice。

## Type4运行时合同

`EffectSound.configure`按`sounds[].name`小写建立`ww137`到asset的映射。
`EffectSound.play`创建独立HTMLAudioElement，并同时接`ended`和`error`到voice结束
清理。媒体自然结束时，`EffectSound.finished`返回true；节点`additionalEnd`据此结束
生命周期，随后`EffectSoundNodeState.end`调用`EffectSound.stop`，暂停媒体、清除
source并回收voice。

运行停止、房间清理与整树释放继续走现`EffectRuntime.clear`、`clearRoundEffects`和
`EffectSound.clear`路径；这些路径停止全部voice并清空共享last，不为ww137增加并行
消费者或队列。

## 限制

以上生产通知和Type4行为来自当前源码合同；未运行测试、浏览器或native链路，也未做
播放、听感、双端完成或资源生命周期实测。补作与第二槽实际输出仍待运行验收。
