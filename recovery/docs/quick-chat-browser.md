# M6-08-Q 快捷聊天浏览器验收

PASS。原生浏览器操作完成编辑器、八个快捷键、双页权威聊天、CPU 对局与断线恢复验收。

运行 `node --import tsx tests/browser-quick-chat.mjs`。脚本独立启动真实服务端、Vite 和 Chromium；端口分别为 3177、5217、9287，账户数据库和浏览器 profile 使用临时目录。

通过原生 CDP 鼠标、键盘和输入操作编辑 F5–F12 文本，覆盖保存、取消、恢复默认、72 字符上限、控制字符拒绝、刷新、新页和同一 profile 浏览器重启。截图覆盖 1920×1080 和 3840×2160。

两个普通浏览器账户通过创建、加入同一房间进入 WAITING，逐键发送八条快捷文本。只读解码网络帧核对 RoomChat 请求、成功应答以及两页的 RoomEvent，检查服务端玩家身份和日志中每条消息恰好出现一次。普通未发送草稿保留，重复按键、修饰键、聊天输入焦点、设置弹窗、空预设和房间外按键均不产生快捷聊天请求。

普通 mode4/map7 房间通过添加三名 CPU 和 Ready 进入 PLAYING，检查快捷消息成功后普通移动请求继续发送，服务端位置随之变化。真实停止独立服务端验证可见断线提示和预设保留，重启服务端、刷新并正常创建房间后验证已保存快捷消息仍能发送。

证据：[JSON](../output/browser-quick-chat.json)、[1080p 设置](../output/browser-quick-chat-1080p-settings.png)、[4K 设置](../output/browser-quick-chat-4k-settings.png)、[等待房间发送者](../output/browser-quick-chat-waiting-self.png)、[等待房间接收者](../output/browser-quick-chat-waiting-peer.png)、[CPU 对局](../output/browser-quick-chat-playing.png)、[断线](../output/browser-quick-chat-disconnected.png)、[同 profile 重启](../output/browser-quick-chat-profile-reopened.png)、[服务端日志](../output/browser-quick-chat.log)。JSON 记录 21 项检查、网络事件和完整进程清理状态。

最终实现另经 `--repeat-defaults-only` 定向验收：F5 重复按键仅发送一次，空白 F12 不发送且保留当前房间，普通输入文本按 Enter 获服务端应答、日志确认并清空输入框。[定向 JSON](../output/browser-quick-chat-repeat-defaults.json) 与[截图](../output/browser-quick-chat-repeat-defaults-room.png)记录该结果。

## 验收范围

结果针对重建房间频道 0。未注入世界、血量、计时或战斗结果；只读 Battle 实例用于等待资源就绪。浏览器验收不替代 OS 输入法或原客户端私聊、公共频道协议证据。无法通过有效预设触发的服务端拒绝由已有 RoomChat 协议验收和快捷聊天组件失败反馈测试覆盖。
