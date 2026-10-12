# 0006 仙剑岛庭院原环境声音

正式仙剑岛庭院现消费原 Sound238/BG06、298/BG11、299/BG12。合法 mode1/map6 的正式 React 原地图选择→建房/卡片加入→两 CPU/Ready→普通键盘与托管移动→原声实际输出→Leave/重入/再Leave 完整通过。

独立 export_scene_environment_sound06.py 发布三原记录，export_scenes.py 只加独立hook，MapEnvironmentSound 只加map6资格。source06 JSON/log PASS完整原Sound尾字段、enabled1/gain1/interval0/random0、原位置和WAV字节，selector−1与ref100/max1600/rolloff2复用已验原Sound合同。

接受 `browser-scene-environment-sound06-2026-10-04T15-46-45-262Z.json` 完整PASS和独立严格 `scene-environment-sound06-actual.json/.log`。四玩家正式普通对局，routeInputs保存沿原getBattlefield/createOriginalBotNavigation/findBotPath规划发出的KeyA/D/W真实输入、当时player与tick；不注入位置、相机、伤害、时钟或事件。两个网页三原声均实际playing与自然回绕，panner原位置、WAV duration与每个listener距离增益误差小于1e−6。

| 网页 | BG06/BG11/BG12回绕 | 最大空间增益 | 浏览器实际 master 输出峰值 |
| --- | --- | --- | --- |
| 1 | 9 / 12 / 5 | 0 / 0.173551 / 0.107543 | 0.0157592 |
| 2 | 9 / 11 / 5 | 0.585099 / 0 / 0 | 0.0599866 |

33个网页2 listener姿态来自普通移动；网页1为3个记录姿态。三原声分别在至少一个网页有正距离增益，另一端距外0保留原声音规则。parallel analyser读取实际master波形，正常destination仍连接，未用音量值或资源加载代替声音输出。两playing PNG来自正式canvas，图像不代替声音波形验收。

普通Leave三旧audio每端paused、source/panner/gain逐一断开/count0；正常同图新房加入/CPU/Ready重入三新voice playing，旧voice保持暂停；再次Leave六旧voice逐节点断开/count0。cleanup06.json PASS3324/5354/9554无监听、专属process/tmp0，Webtype与脚本语法PASS。

## 未完成范围

首 `15-43-34-119Z.json` 原整体FAIL保留：初始托管路线有一端所有原声在有效距离外，实际master输出为0，不接受为双端输出。第二段运行期间同样保留早期距外0，最终自然移动后实际两端非零与完整生命周期已记录；没有第三次run。

本片不关闭M3-05或整map6父项。原地图静态物件/碰撞消费者复用既有证据，不新增碰撞授权。浏览器混音波形不代人耳/OS录音/原OpenAL采样等价；1280×720软件画布不代高清性能或原GPU精度，未恢复原服务规则。主线如无原对应子项可登记M3-05-SOUND06限定消费者切片，集成上述source/module/wire/actual证据并统一发行验证；tasklist/progress由主线维护。
