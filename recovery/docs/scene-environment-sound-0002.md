# 0002 田野路原环境声音

正式田野路现消费原 Sound318/BG06、319/BG05、338/BG11、339/BG12。原 WAV、四个位置与尾字段已核对；正式 React 大厅正常选图、建房、加入、两 CPU 与准备进入团队对局，普通托管移动产生双端非零浏览器声音输出。完整离房重入验收尚未完成，M3-05 与整张地图保持未完成。

## 文件与来源

- `recovery/export_scene_environment_sound02.py` 发布独立 `scene-environment-sound-0002.json`，原 `Data/scn/0002/0002.obj` 四 Sound 的 enabled1、gain1、interval0、randomGate0 与位置完整保留。
- `recovery/export_scenes.py` 加入该导出调用；`apps/web/src/audio/map-environment-sound.ts` 仅新增 map2 资格，复用正式 Battle 加载、listener 更新与 clear。
- `tests/scene-environment-sound02-source.py` 与 source.json：四原 WAV 字节一致，空间参数复用 `scene-environment-sound20-native.json` 原 loader/manager 合同，selector−1 循环、ref100/max1600/rolloff2。
- `tests/browser-scene-environment-sound02.mjs`：正式 `/`，原地图选择器和建房窗口、房间卡片加入、CPU/Ready/Autopilot 与正常离房；观察器不写玩家位置、相机、伤害、时钟或事件。

## 实际声音

接受原 `browser-scene-environment-sound02-2026-10-04T15-31-48-209Z.json` 中完成的 PLAYING/声音段，原整体 FAIL 不改。两个网页均是合法 mode1/map2、四玩家；四原 WAV 实际播放并自然回绕，原空间位置、duration 与距离 gain 逐记录核对误差小于 1e−6。

| 网页 | BG06/BG05/BG11/BG12 自然回绕 | 最大空间增益（同顺序） | 浏览器 master 输出峰值 |
| --- | --- | --- | --- |
| 1 | 3 / 5 / 4 / 2 | 0 / 0 / 0.794510 / 0.905770 | 0.0442994 |
| 2 | 2 / 2 / 2 / 1 | 0.548569 / 0.032542 / 0 / 0 | 0.0752635 |

只读 listener 随普通输入改变，两网页分别有 4/3 个记录姿态。各个原声至少在一个网页有正空间增益；距外零增益保持原规则。parallel analyser 读取既有 master 的实际波形，保留 destination 连接；没有以音量设置或文件加载代替输出。`scene-environment-sound02-actual.json` 标记 `PASS_PLAYBACK_ONLY`，并保留 rawStatus=FAIL。两张 `15-31-48-209Z-playing-{1,2}.png` 是原正式实战截图；第一张可见田野路南瓜、树、围栏、喷泉及普通玩家战车。本片复用既有地形、静态放置和碰撞证据 `battlefield-runtime.md`，不重复宣称逐实例精度。

普通 Leave 后两端 world=null、voice count0，八个原 audio 均 paused。`scene-environment-sound02-process-cleanup.json` 确认 3322/5352/9552 已关闭、专属进程和临时目录为零。Web 类型检查与专项脚本语法检查通过；发行构建交主线统一执行。

## 未完成范围与失败证据

`15-28-38-117Z.json` 与 `15-29-59-731Z.json` 均保留 FAIL：建房弹窗尚未卸载时 CPU 点击未生效，停在 WAITING 单玩家。`15-31-48-209Z.json` 已贯通正常 CPU/双端实声，但 disconnect 观察器把十二次调用写入最后一条声音的 gain 字段，逐节点断开断言失败；map load 的 id 同样被记录为最后 placement339，不能以该字段证明 mapId。合法选图来源以双端权威 initial mapId2 与声音源位置核对为证。观察器已经修正词法捕获，修正后没有重新运行，不据此验收断开节点。

重入、第二次离房及完整生命周期未执行，不标 PASS。严格完整 verifier 保留；`--playback-only` 只接受完成的声音段，不接受错误 loaderMapMetadata 或节点断开日志。对应原始 browser.log、browser-run2.log、browser-run3.log 与三份 raw 全部保留。

声音输出范围为浏览器混音波形，不是人耳听评、OS 扬声器录音或原 OpenAL 采样等价；未验证高清性能、全地图玩法与原完整加载行为。原静态几何与碰撞基线复用，本片不关闭其父项。

## 给主线的原位更新建议

归入 M3-05；若没有对应子项，登记未勾选的 M3-05-SOUND02。记录 source/module/formal wire 已交付，actual 仅双端普通 PLAYING 原声音输出范围通过，Leave count0/paused 有效，逐节点断开和重入保持未完成。保留原整体 FAIL 与以上具体入口，主线集成代码并统一发行验证。没有修改 tasklist.md 或 progress.md。
