# 音量保存与恢复浏览器验收（M5-14-A）

验收通过：1080p/4K 原生滑杆、0 与非零保存恢复、Chromium 同配置目录重开恢复、真实音乐播放、声音消费者、正常房间退出重进，以及独立存储诊断。

`node --import tsx tests/browser-volume-settings.mjs` 使用独立 Vite 5214、真实服务端 3174、Chromium 9284、临时账户数据库和专用浏览器配置目录。浏览器不放宽自动播放策略。正常页面使用原生滑杆、真实鼠标聚焦和 Home/End/方向键输入。

## 正常页面

1920×1080 与 3840×2160 页面显示百分比并恢复相同设置。音乐 75%、音效 25% 与双项 0 均通过刷新和新页面恢复。入口同步调用真实 `Battle.setMusicVolume` 与 `Battle.setSoundVolume`，检查首次调用值；退出并重新启动 Chromium 后，使用同一 user-data-dir 恢复设置。

正常房间创建、退出、重进沿现有按钮与服务端接口完成。播放使用正式地图 MP3，真实媒体时间前进。音乐静音不改变音效；音效静音不改变音乐。每次滑杆修改同时检查实际音乐 HTMLAudioElement、BattleSound Web Audio 总增益、EffectSound 音量与 EffectSkillSound Web Audio 总增益。退出暂停并释放音乐源、将战斗声音增益归零；重进先保留音乐 0、音效 25%，随后正常滑杆恢复音乐 75%。

浏览器观察器仅在独立 Vite 的 Battle 模块末尾包装两个 setter，记录值并立即调用原方法。它不替换消费者、不改变返回值、不注入战斗状态。每次实际操作先激活被操作页面，4K 截图完成后关闭该页面。

## 明确诊断 fixture

真实声音设备探针通过现有 EffectSound 与 EffectSkillSound 后端循环播放原 GA15 WAV，读取媒体时间和技能声音总线分析器。正常音效滑杆调整正在播放的媒体音量与 Web Audio 总增益。技能总线峰值分别为 25% 的 0.06748、静音的 0、100% 的 0.32888；两路媒体时间均持续前进。该探针直接调用声音后端，不作为玩家真实施放技能或战斗事件链的证据。

畸形 JSON、越界音乐字段与存储禁用分别在独立浏览器上下文诊断。畸形 JSON 回到 HTML 原默认 50%/50%，正常键盘修改可重新保存；越界音乐回到 50%，有效音效 25% 保留。存储禁用仅令音量键的 Storage.getItem/setItem 抛出 SecurityError，账户存储仍正常；页面显示无法保存提示，滑杆仍立即更新真实 Battle 消费者。

## 证据

- `recovery/output/browser-volume-settings.json`：正常路径、首次 setter、消费者数值、设备输出与独立诊断结果，以及专用进程清理结果。
- `recovery/output/browser-volume-settings.log`：专用服务端日志。
- `recovery/output/browser-volume-settings-1080p.png`、`-4k.png`：两种视口的音量 UI。
- `recovery/output/browser-volume-settings-room-muted.png`：正常房间音乐静音、音效 25%。
- `recovery/output/browser-volume-settings-reopened.png`：Chromium 重开恢复。
- `recovery/output/browser-volume-settings-storage-disabled.png`：存储禁用提示。

## 限制

声音设置保存于浏览器本地，不跨配置目录或设备同步。本验收覆盖音量 UI、保存恢复和声音消费者，不评价 4K 战斗性能，也不重新证明技能事件链或原程序音量持久化实现。
