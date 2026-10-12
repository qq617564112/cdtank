# 效果声音音量设置

M5-14-A专项验证通过。`tests/effect-volume-settings.cts`使用正式`EffectRuntime.setVolume`、`EffectSound`、`EffectSkillSound`和Type4的`EffectSoundNodeState`，读取发布声音目录中的GA15。

初始化前设置0或0.375，配置声音目录后Type4媒体音量与技能声主增益保持设置值。初始化后改为0.25，已有及后续声音使用最新值；再设为0，已有和后续声音保持静音。Type4结束会停止对应媒体，runtime.stop清空两类voice并停止媒体；重新start并配置目录后，Type4媒体音量和技能声主增益仍为0，退出后voice再次归零。

运行`npx tsx tests/effect-volume-settings.cts`生成`recovery/output/effect-volume-settings.json`。本专项未发现需要修改正式代码的音量缺陷。

## 验证范围

媒体与AudioContext是夹具边界，验证音量赋值和生命周期，不证明实际设备播放、原音频逐样本或特效精确还原。
