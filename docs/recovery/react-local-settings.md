# React快捷聊天与音量设置（E-R04-S）

正式入口是App下的QuickChatSettingsView和VolumeSettingsView，旧DOM注册器已删除。main在createRoot/render之前调用settings-startup.initializeSettings，安全读取浏览器现有配置，同步交给Battle的键位、快捷聊天和音频消费者，并先应用显示偏好。React负责交互与显示，Battle继续负责普通输入、权威聊天请求和音频实例；不增加网络或账户保存协议。

快捷聊天外层保持最后成功保存的八条确认值，关闭只卸载草稿会话；重新打开从确认值复制，不退回启动快照。只有验证及localStorage写入成功后才更新Battle与外层确认值。拒绝存储保留生效值和当前草稿；取消卸载草稿；成功保存清除启动读取失败提示。原F5–F12输入过滤、权威发送、重复抑制、房间代际与已输入聊天草稿继续由现有BattleChat拥有。对话框effect只负责浏览器modal及焦点释放，页面草稿不通过effect同步给Battle。

音量滑条立即应用到Battle，与旧规则一致；写入失败仍保留当前即时音量，并明确提示刷新恢复默认。启动缺失/损坏/不可读值沿用原偏好模块的0.5默认和有效字段回退；零值不被当作缺失。滑条与output为真实JSX，事件更新局部状态而非战斗逐帧更新App。

显示偏好由 `cdtank.display-settings.v1` 保存 `{highPrecision,silhouette}`，首次启动同步恢复当前全档并在React渲染前供三维/描边消费者读取；设置页每次打开复制当前生效值，默认/取消只处理草稿，确认保存成功才应用。保存失败保留当前生效显示和草稿。此持久为浏览器本地重建，不是原账户服务端设置。

验收索引由react-settings-browser.md收录。settings-startup.cts覆盖同步应用顺序、零音量和不可读存储默认；quick-chat.cts与audio-preferences.cts保留真正业务规则检查，删除依赖旧DOM注册器和静态index.html的失效测试。真实CDP输入、中文IME、双端八快捷键、音频输出、高清与同浏览器profile恢复由相关网页脚本验收，组件检查不代替这些证据。此片只关闭设置迁移，完整聊天窗口仍是旧实现；这些设置布局为既有重建，不是原Config界面1:1证明。
