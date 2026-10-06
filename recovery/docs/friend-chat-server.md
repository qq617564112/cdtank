# 好友频道

好友频道由当前发送账户的单向好友列表决定收件人。只向当前认证在线、且没有屏蔽发送方的好友账户投递；发送方收到回显，各账户全部认证连接各收一次，跨大厅与房间。没有有效好友时拒绝 `FRIEND_CHAT_NO_RECIPIENTS`，无消息投递。

`ReqFriendChat` 为 `{text,roomId?,round?}`。origin 字段必须成对。无 origin 只能从当前大厅连接发送；有 origin 验证当前连接房间成员与当前局号，允许 WAITING、PLAYING、FINISHED。文本为 1 至 72 UTF-16 码元，拒绝空白与控制字符后 trim。响应 `{message,recipientCount}`，数量仅计有效好友账户，不包含发送方；不暴露好友身份列表。消息为 `{id,accountId,senderName,text,message,roomId?,round?}`，显示文本 `[好友] 昵称: 内容`。

错误为 `ACCOUNT_REQUIRED`、`FRIEND_CHAT_REJECTED`、`FRIEND_CHAT_IN_ROOM`、`NOT_JOINED`、`ROUND_CONFLICT`、`FRIEND_CHAT_NO_RECIPIENTS`。模块 `social/friend-chat.ts` 注册 `registerFriendChatApi(server,accounts,world,accountByConnection,sessions)`；好友与黑名单表使用既有权威读取，不写新关系。

## 原来源

`recovery/evidence/chat/friend-chat-source.py` 执行供给 CDTank.exe 的完整好友选择回调 `0x4cbe44`，CEGUI 与观察者接口提供边界。源 `rdoFriend` 对象位于 HUD `+0x684`，选中时 HUD `+0x908` 写入 3，并通知频道观察者、切换源按钮与输入。未选中不改变频道。

原输入发送静态路径为 `0x4d332f → 0x4912c5`，消息频道 `+0x48` 为 3 时分支 `0x4913d2 → 0x48da02 → 0x413ec4`。执行向量与逐指令证据保存于 `friend-chat-source.json`。原消息角色标记过滤路径保存 `0x48e377`、`0x4909af`；角色字节 `+0xc` 非零会跳过各自后续处理。

## 网络验收

`tests/friend-chat-network.cts` 使用实际 index 服务器 3211 和六个真实连接，包含发送方与好友的第二连接、未认证连接和第三账户。`friend-chat-network.json` 为 PASS：验证各连接精确投递数量与权威消息、单向关系、blocked 排除与全部不可达拒绝、文字/身份/origin/stale round 拒绝、跨大厅和不同房间、正常 CPU/Ready 后 PLAYING、3 秒自然 FINISHED、Rematch round2 成功与旧局拒绝。原日志为 `friend-chat-network.log`。

## 已知边界

原服务端好友路由、批准规则及消息标记过滤的完整频道范围未知。当前服务器好友与屏蔽路由明确重建；原数值 3 与原 selector 执行证明不替代原服务端范围恢复。当前 UTF-16 长度采用既有重建文本资格。
