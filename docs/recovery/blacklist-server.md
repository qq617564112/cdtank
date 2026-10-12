# 黑名单与密语

黑名单按账户单向持久保存于独立 `account_blacklist` 表。接收方屏蔽发送方时，大厅与房间密语返回 `WHISPER_BLOCKED`，保留客户端草稿，不构造或投递消息。发送方屏蔽接收方不阻止其主动发送，公开与队伍聊天沿用已有规则。

`ReqBlacklist` 为 `{operation:'QUERY'}` 或 `{operation:'ADD'|'REMOVE',targetAccountId:string}`。返回 `{blocked:BlockedRecord[]}`，记录包含 `accountId,name,online,inRoom`。owner 取当前认证连接，target 必须是持久存在账户。离线可增；重复添加、删除不存在关系幂等；自己拒绝 `BLACKLIST_SELF`，不存在账户拒绝 `BLACKLIST_TARGET_NOT_FOUND`，未认证拒绝 `ACCOUNT_REQUIRED`。

`AccountBlacklist` 负责独立持久关系与请求，`AccountStore.blacklist(owner,request)` 转发权威 ID 列表，`isBlocked(owner,target)` 查询方向。`registerBlacklistApi` 补当前昵称、在线连接与房间状态。好友关系与原角色资料不变。

## 原客户端来源

`playerlist_playerinfo.xml` 提供 `btnAddBlacklist` 与 `btnRemoveBlacklist`。原初始化 `0x4eeb8a` 与 `0x4eebc4` 将它们保存到对象 `+0xf8`、`+0xfc`。最小回调 `0x4eff44` 与 `0x4eff97` 使用 `this+0x4c` 目标、`this+0x50` 附加值与布尔添加/删除参数，调用 `0x426794`。该入口按布尔值选择不同原请求对象并调用发送入口 `0x413ec4`。

角色标记 getter `0x40cd6f` 读取角色 `+0xc` 字节；源资料根据它切换黑名单按钮。消息消费者 `0x48e377` 与 `0x4909af` 读发送角色标记，非零时跳过各自后续处理。字节与分支保存在 `recovery/output/blacklist-source.json`。

好友成员查询 `0x48b6ff` selector 1 使用 `+0x24/+0x28` 容器，selector 0 使用 `+0x18/+0x1c` 容器；`0x48bb53`、`0x48bba1` 在两容器间移动记录。它们是好友查询路径，与黑名单角色标记路径分开。

## 网络验收

`tests/blacklist-network.cts` 使用实际 index 服务器 3209 与五条 WebSocket 连接，正常认证、建房、密语与关启操作。`blacklist-network.json` 为 PASS，验证单向账户隔离、离线添加、增删幂等、自身与不存在账户拒绝、多连接发送方、双向与无关账户密语、房内发送到大厅或另房接收方的拒绝与解除。所有拒绝都验证全部连接密语数量不变。

正常 CPU 添加与 Ready 使房间进入 PLAYING，3 秒自然截止进入 FINISHED；两阶段均验证被屏蔽密语拒绝及无投递，实际样本保存于 `evidence.naturalPhases`。

实际 SIGTERM 服务器退出再启动同一 SQLite 后，黑名单恢复并继续拒绝；解除后成功。原角色 368 字节及两个资料字符串、已有好友关系保持一致。日志为 `recovery/output/blacklist-network.log`。

## 已知边界

上述原来源为静态反汇编检查，未声称执行原黑名单回调或恢复完整消息频道范围。原服务端接受、批准与过滤规则未知；服务器权威拒绝两种密语是明确重建规则。两个好友容器的总量门限不套用为黑名单容量规则。
