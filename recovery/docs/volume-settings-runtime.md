# M5-14-A 音量设置保存恢复

正常大厅及对局保留现有音乐/音效滑杆，独立显示百分比。通过普通鼠标或键盘改变值后，立即更新实际播放消费者，并将两项写入浏览器 localStorage。刷新、打开同源新页面或重开同一浏览器配置文件时，同步恢复保存值，早于正常房间载入与首次播放；静音值 0 不被默认值覆盖。离房仅停止声音，不重置用户设置。

默认音乐/音效均为 0.5，来源是未修改的 `CDTank/Config/SystemSetting.ini` 的 `[Volume]`；音频导出器写入 `audio.json` 的 `defaultMusicVolume/defaultSoundVolume`。规则测试同时检查音频目录和 HTML 初始值。Web 保存位置、存储键、百分比输出及成功/失败提示均为重建交互，不宣称恢复原 settings.xml 全107控件或原写回 INI 的回调。

模块边界：

- `interface/settings/audio-preferences.ts` 只负责两项偏好校验和浏览器保存；每个字段独立校验有限数值及 0..1，坏 JSON、数组、null 回退默认。无法读写存储返回失败，不阻塞调节声音。
- `interface/settings/volume-settings.ts` 负责正常滑杆、百分比与可访问提示；`main.ts` 在注册房间入口前同步调用。账户页面模块不再拥有音量设置。
- `Battle.setMusicVolume` 调用既有 `BattleMusic`；`setSoundVolume` 同时更新既有 `BattleSound`、`EffectRuntime` 内的 `EffectSound` 和 `EffectSkillSound`。没有新增播放实现，也没有修改账户、玩法或技能施放条件。

失败时，页面仍应用当前音量，并显示“无法保存音量设置，刷新后将恢复默认值。”保存属于当前浏览器/站点本地偏好，不跨设备同步；多个已打开页面不自动联动，重新载入会读到最新值。

验收入口：`npm run test:settings:audio`（源默认值/非法与静音数据/存储失败；Type4与技能声的初始化、在播更新、停止与重进设备夹具）；`npm run test:settings:audio:browser`（正常真实网页与音频设备）。夹具不代替真实设备表现，页面验收细节见 `volume-settings-browser.md`。工程检查为全仓类型、正式模块依赖门禁及客户端独立构建；未改战斗/服务端，不重复五模式两局或账户重启验收。
