# 0020 环境声音

地图0020的Sound268/BG08使用原WAV与放置坐标，以原gain1和selector−1循环播放。`export_scene_environment_sound20.py`随`export_scenes.py`发布`scene-environment-sound-0020.json`；`MapEnvironmentSound`支持0020与0021，沿既有Battle地图load、相机listener更新、音效音量和Leave清理消费。

| 源ID | 名称 | 原坐标X/Y/Z | gain | intervalMs | randomGate | selector |
| --- | --- | --- | --- | --- | --- | --- |
| 268 | BG08 | 325.964996 / −0.000007629 / −309.726013 | 1 | 0 | 0 | −1 |

## 原程序与发布来源

原`0020.obj`仅一条`SYcScnObjSound`，enabled=1；其35字节尾部为`a2468377000000000004000000424730380000803f0000000000a14683770000000000`。公共stamp为`0x778346a2`，字段为`field04=''`、`field20=0`、`field24='BG08'`、`field5c=1`、`field60=''`、`field88=0`；派生stamp为`0x778346a1`，intervalMs和randomGate均为0。

`tests/scene-environment-sound20-native.py`对这条实际0020记录执行原子对象构造器`0x462b6c`、尾部加载器`0x45eaab → 0x461f60`、启用`0x462934 → 0x462160 → 0x485b1b`、更新`0x45f07e`、停用`0x462934 → 0x48568d`。加载消费完整35字节；构造器spatial=1，启用传原位置、BG08、selector−1、direction`[0,0,−1]`并设置gain1；零interval更新不增加启动，停用执行stop。流与字符串IO、公共放置头、导航/效果回调、WAV管理器play/gain/stop为记录边界。

共享manager原`0x416a93 → 0x571e9f`设置reference100、maximum1600、rolloff2；原OpenAL选择器−1循环与空间源参数实际执行复用`skill-effect-actor-native.json`。浏览器独立gain按原linear-clamped距离公式计算，panner固定原位置，listener跟随相机；上下文借用EffectRuntime。

`scene-environment-sound20-source.json/.log`为PASS，逐原记录/完整尾部与原native结果核对发布字段；`audio.json`指向`audio/sound/BG08.wav`，发布字节与`CDTank/Data/sound/BG08.wav`一致，原时长25.495419501秒。标准场景导出PASS见`scene-environment-sound20-export.log`。

## 正式双页面验收

`browser-scene-environment-sound20-2026-10-04T00-05-00-192Z.json/.log`为PASS。普通mode5/0020双网页以默认001战车、两CPU和真实Ready进入PLAYING；W/A/D按只读原NAV路线引导双方正常移动，浏览器使用默认autoplay。实际渲染内部尺寸降低至320×180用于专项声音采样。

每端只load0020一次、仅Sound268一voice，原BG08 WAV均触发playing，实际duration25.49542秒、loop=true；两端借用原EffectRuntime声音上下文，panner均为原放置坐标，listener随正常相机移动。

| 网页 | 自然帧采样 | 实际时间回绕 | gain范围 |
| --- | --- | --- | --- |
| 1 | 52 | 2 | 0–0.097025976 |
| 2 | 50 | 1 | 0–0.099292070 |

源参数与已记录listener按reference100、maximum1600、rolloff2计算实际gain，误差小于1e−6。Home音效滑条将主端master设0，播放仍运行且currentTime从0.452789推进至2.656527秒；End恢复master1。双方普通Leave后各voice0、旧Sound268 audio paused，实际调用source、panner、gain的disconnect，共享context仍running。

专用3296/5326/9526监听、服务/浏览器进程及临时目录均已清理，独立收尾记录为`scene-environment-sound20-process-cleanup.json/.log`。本次以短局完成声音验收；再战/断线场景生命周期沿用既有0021消费者证据。Web类型与构建由root在并行界面切片稳定后统一执行。

## 限制

本项覆盖0020 Sound268/BG08。原OpenAL设备与浏览器equalpower声像的逐样本一致性未建立。

集成工程验收：`battle-info-env20-web-build.log` 独立Web类型与生产构建PASS（2m），`battle-info-env20-boundaries.log` 312正式模块边界PASS；同一证据由本片与并行切片共用。root独立保存证据复核见 `scene-environment-sound20-root-verifier.json`。
