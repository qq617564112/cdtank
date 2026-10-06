# 大厅密语服务

`registerLobbyWhisperApi(server,accounts,accountByConnection,sessionByConnection)`注册独立`LobbyWhisper`。请求包含`text`以及且仅一个目标选择器`targetAccountId`或`targetName`；响应为`{message:MsgLobbyWhisper}`。消息字段为进程内递增`id`、发送账户`accountId`、`targetAccountId`、权威`senderName`/`targetName`、修剪后的`text`及`[密语] 发送者 → 目标: 文本`。

发送者必须认证并在大厅。目标按当前认证大厅账户解析，账户ID是明确身份；昵称先trim再与已确认名字精确匹配，同名多账户返回`WHISPER_AMBIGUOUS`，不猜选。目标账户有至少一个大厅连接即可接收，房间中的同账户连接不接收。只向发送者和目标当前大厅连接广播一次，每个连接一份；第三账户和未认证连接隔离。成功响应确认同一消息，失败不广播。

文本沿用公共聊天的原请求72个UTF-16码元上限、控制字符及空白拒绝规则，通过后trim。未认证返回`ACCOUNT_REQUIRED`，房间发送者返回`WHISPER_IN_ROOM`，无效文本或选择器返回`WHISPER_REJECTED`，本人目标返回`WHISPER_SELF`，不存在或无大厅连接的目标返回`WHISPER_OFFLINE`。每次请求读取当前连接状态，正常入房、Leave、断线与重新认证自动改变资格；模块不写持久数据。

协议沿用现有`npm run protocol:generate`生成，相关严格类型检查通过。`npx tsx tests/lobby-whisper-network.cts`通过：3203正式index服务、临时账户库及五个真实WebSocket连接，六次成功密语覆盖名字/ID、同名歧义与明确ID、多连接、房间和第三方隔离、拒绝、Leave及断线恢复，并验证普通公共聊天只投递一次。证据输出`recovery/output/lobby-whisper-network.json`和同名日志；专属服务与临时数据已清理。

## 来源边界

原频道入口线索沿用`chat-channel-source`，此处的大厅目标解析、协议和服务端路由是明确重建；不声明恢复原密语服务器，不扩大好友或其他频道规则。网页显示与普通鼠键操作由对应浏览器验收提供。
