# 0021 环境声音

地图0021的三个`SYcScnObjSound`使用原BG06、BG12、BG11 WAV，以原放置坐标循环播放。环境声音由地图生命周期持有；每轮技能效果清理不停止环境声，离房、断线和场景销毁停止声音。

| 源ID | 名称 | 原坐标X/Y/Z | 音量 | 循环 |
| --- | --- | --- | --- | --- |
| 143 | BG06 | 955.315979 / 0 / 10.844000 | 1 | -1 |
| 168 | BG12 | 81.582497 / 0 / 57.227001 | 1 | -1 |
| 169 | BG11 | -0.692685 / 0 / 28.412800 | 1 | -1 |

## 原程序链

Sound虚表为`0x5c7558`。专用加载器`0x45eaab`调用公共加载器`0x461f60`，然后读派生标记`0x778346a1`、DWORD定时间隔`+f0`、BYTE随机门禁`+f4`。三个35字节尾部的公共字段均为：`field04=''`、`field20=0`、`field24=BGxx`、`field5c=1`、`field60=''`、`field88=0`；派生间隔和随机门禁均为0。

子对象构造器`0x462b6c`设置空间声音标记`+58=1`，当前加载器不改该标记。启用`0x462934`调用`0x462160`，先停止旧描述符，再调用`0x485b1b`，传原名字、对象`+58`位置、循环选择器`-1`、方向`[0,0,-1]`。返回描述符保存到子对象`+40`，随后`0x571de5`应用`field5c`音量。停用同一入口调用`0x48568d`停止描述符；析构`0x46299f`先执行停用。

更新`0x45f07e`在`+f0=0`时立即返回，三个环境循环不由每帧重新启动。原通用播放器`0x571d14`对选择器`-1`执行`0x5750cb(true)`后启动OpenAL声源。Sound入口未覆写空间距离；共享声音管理器初始化`0x416a93 → 0x571e9f`设置reference=100、maximum=1600、rolloff=2，距离模式为`AL_LINEAR_DISTANCE_CLAMPED (0xd004)`。

`tests/scene-environment-sound21-native.py`执行原子对象构造器、三个专用尾部加载器及启用/更新/停用，流与字符串IO、公共放置头、地图导航/效果、WAV管理器是记录边界。三个完整尾部均消费35字节，启用各产生一次原名字/位置/循环/方向与音量，零间隔更新不新增启动，停用各停止一次。原共享OpenAL播放器的实际源参数与循环开关执行见`skill-effect-actor-native.json`选择器-1条目。

## 浏览器实现

`scene_sound.py`按原字段解码；`export_scene_environment_sound21.py`从原`0021.obj`发布`scene-environment-sound-0021.json`，随场景资源导出运行。`MapEnvironmentSound`消费0021的三条记录与[0020 Sound268/BG08](scene-environment-sound-0020.md)，其他地图不建立环境声音。

Owner借用已配置的`EffectRuntime.audioContext()`，独立持有gain、panner和三个HTMLAudio循环；不会创建或关闭共享AudioContext。相机每帧更新原空间的listener位置和方向，源panner固定为原放置坐标。音量菜单控制master gain；静音保留循环进度。浏览器限制首次播放时，真实pointer/key交互重试仍在地图中的循环；清理移除所有voice，离房后交互不恢复旧声音。Web Audio线性panner的rolloff上限为1，因此panner自身距离增益关闭，独立gain按原rolloff2公式计算并在0处截断。

## 限制

本项环境声音闭环覆盖0021；0020的独立证据见其运行文档。浏览器equalpower声像与原OpenAL设备声像不构成逐样本一致性证明。

## 正式双页面验收

`browser-scene-environment-sound21.json/.log`为PASS。两普通网页以原105账户角色、模式5/0021、两CPU、真实Ready/autopilot移动和射击运行；浏览器未设置自动播放豁免。两端三条原WAV均触发`playing`，播放时长BG06=12.398458s、BG12=20.817279s、BG11=9.626032s；约89次自然帧采样观察到分别7/4/9次播放时间回绕。每端首次地图加载仅一次，活跃声音一直为三条，共用现EffectRuntime声音上下文。

| 原声音 | 网页1实际gain范围 | 网页2实际gain范围 |
| --- | --- | --- |
| BG06 | 0–0.759648 | 0–0.352154 |
| BG12 | 0–0.463724 | 0–0.901301 |
| BG11 | 0–0.349019 | 0–0.932438 |

真实音效滑条Home将master从0.5设0、End恢复1；三个循环均保持playing。双方自然清完73个目标进入FINISHED，再战round2各仍为三voice，旧voice退休数0、播放持续。双方离房各清至0且三旧audio全部paused。主端普通建房重入恢复三voice后实际停服务器造成断线，再次清至0且旧audio全部paused；重启服务器、普通返回/建房重入恢复三voice，最终离房活跃0，主端累计9条、客端3条退休audio全部paused。

专用3287/5317/9517监听已关闭。TypeScript检查通过；统一Web构建与模块边界检查由集成负责人执行。该实战不注入角色位置、相机、世界状态或伤害。
