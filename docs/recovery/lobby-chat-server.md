# 大厅公共聊天服务

`registerLobbyChatApi(server, accounts, accountByConnection, sessionByConnection)`在`apps/server/src/social/lobby-chat.ts`注册独立大厅公共聊天入口。身份读取已认证连接对应的账户ID，当前账户没有可写昵称，显示别名为`坦克手-`加账户ID前六位；不推测原资料字符串的名字索引，不接受客户端姓名。

## 协议与资格

`LobbyChat`请求为`{text:string}`。成功响应为`{message:MsgLobbyChat}`，`MsgLobbyChat`包含进程内递增`id`、完整`accountId`、去掉首尾空白后的`text`和服务端拼接的`message`。同一消息通过`LobbyChat`广播一次，然后返回相同内容作为接受确认；确认不代表每个客户端已经显示。

发送者和接收者都必须已认证且不在任何房间。每次广播从当前连接和房间映射选取接收者；正常进入房间后隔离，确认Leave返回大厅后恢复，断线移除账户连接身份。认证与账户事务仍使用现有入口。

文本沿用RoomChat规则：原请求1至72个JavaScript码元，拒绝全空白、控制字符`U+0000..001F`及`U+007F`，通过后修剪首尾空白。未认证返回`ACCOUNT_REQUIRED`，房间内发送返回`LOBBY_CHAT_IN_ROOM`，文本无效返回`CHAT_REJECTED`，均不广播。

## 验收

协议使用仓库现有`npm run protocol:generate`生成。侧相关严格TypeScript检查通过。`npx tsx tests/lobby-chat-network.cts`通过：正式index启动独立3198服务器和临时账户库，四个真实WebSocket连接中三个正常认证账户，六次成功消息和八次拒绝覆盖正常Account、CreateRoom、Leave、断线及重连后的接收资格、权威身份、消息唯一性、文本边界和恢复。实际结果记录于`recovery/output/lobby-chat-network.json`及同名日志，专属服务器和临时数据库已清理。

## 来源边界

大厅频道、账户别名、协议和服务端资格规则是明确重建。原大厅服务器与频道依据尚未恢复。本专项提供真实网络服务证据；网页普通操作及显示由对应浏览器验收覆盖。
