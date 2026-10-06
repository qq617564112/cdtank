# 好友频道正式接线

正式大厅和房间/战斗均可选择好友频道。大厅 `LobbyChat` 持有会话草稿、频道、等待确认及最多100条日志，正常输入提交 `FriendChat{text}`。入房切换 generation 并清草稿和日志；大厅消费者在房内不接收，避免与房间界面重复展示。响应只确认草稿，消息广播负责日志。

房间 `BattleChat` 使用原数值频道3，与公共0、队伍1、密语2分开；普通输入和已有快捷输入共用发送、pending与拒绝保稿逻辑。`Battle` 提交当前权威快照的 roomId/round，认证与成员资格交由服务器。活跃房间的 FriendChat 消息进入既有富文本日志。离房或断线停止房间消费者、清会话并隔离旧确认；再战使用当前局号。

React 的 `LobbyChatChannel` 与 `SourceBattleChat` 控制频道菜单及焦点，普通好友输入使用原正常输入背景。Babylon 场景生命周期、角色步进、账户库存与关系持久化没有改变。消息不保存到账户；好友/黑名单既有保存与重启证据继续有效。

服务端 `social/friend-chat.ts` 经正式 index 注册，协议由 serviceProto 提供。原数值3和选择回调来自原执行；在线单向好友、接收方屏蔽过滤及跨位置路由为重建规则，范围见 friend-chat-server.md。

## 集成检查

`friend-chat-client-rules.log` 验证已有快捷发送通路的好友频道、pending锁、拒绝保稿与确认清稿；`friend-chat-client-types.log` 及 `friend-chat-web-types.log` 类型通过。`friend-chat-channel-sound-boundaries.log` 验证354个正式可达模块没有验证/取证入口依赖。两端独立构建通过，日志为 `friend-chat-channel-sound-build-{web,server}.log`，Web构建1分40秒。

真实网络与正式网页验收分别由 friend-chat-server.md、friend-chat-browser.md记录。原公共、队伍、密语、CPU连续两局和账户持久化基线复用；本次不改变这些规则，不重复全套回归。原字体/GPU、完整频道权限和原服务端等价保留父项。
