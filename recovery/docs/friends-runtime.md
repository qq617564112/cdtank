# 好友关系

正式好友业务采用账户权威的单向列表，独立保存于 `account_friends`。`Friends` RPC 返回当前账户完整好友记录；昵称读取已保存账户昵称，在线与房间状态读取当前认证连接。

## 接口

`ReqFriends` 为 `{operation:'QUERY'}` 或 `{operation:'ADD'|'REMOVE',targetAccountId:string}`。`ResFriends` 为 `{friends:FriendRecord[]}`，记录包含 `accountId`、`name`、`online`、`inRoom`。

owner 仅由当前连接认证账户决定。target 必须是已经建立的账户，允许离线；自己拒绝。重复 ADD 不生成重复记录，REMOVE 已不存在关系不改变其他账户。每次增删返回 owner 完整列表，target 列表不自动改变。在线为任一当前认证连接存在，房间状态为任一该账户当前认证连接有房间会话，离线记录 `inRoom:false`。

错误代码为 `ACCOUNT_REQUIRED`、`FRIEND_SELF`、`FRIEND_TARGET_NOT_FOUND`。好友关系不修改原账户角色资料、库存或战斗数据。

生产模块为 `apps/server/src/accounts/social/friends.ts`，SQLite 关系与请求规则在此实现；`apps/server/src/social/friends.ts` 注册 RPC 与实时状态投影。`AccountStore` 仅初始化私有关系模块并转发 `friends` 方法。

## 页面与状态所有权

正式大厅的原 PlayerTab 与 FriendTab 切换目录；选择行后右键或 Shift+F10 打开原资料页，这两个手势为网页重建适配。Enter 或双击保留既有密语选择，以稳定账户ID发送，不将在线状态后缀作为昵称解析。

LobbySocialView 拥有页签与资料选择，PlayerInfoView 拥有窗口、源资源、键盘及焦点；Friends 客户端 store 拥有权威列表、写入 pending 和请求代次，GameConnection 拥有唯一认证连接。迟到查询不覆盖较新的写入，拒绝保留已确认列表，断线清状态并隔离旧响应。大厅独立查询，进入房间暂停、离开页面清除计时器；战斗逐帧快照不驱动目录。

原资料未知称号、家族、积分、房号及描述等保持空白；统计子页附着、QQ、黑名单与交易业务仍属未完成父项。页面实际验收归M5-13-R-PAGE，好友闭环归M6-09-B；客户端请求隔离证据见friends-client-rules.log，正式网页与持久证据见对应任务和friends-browser.md。

## 原客户端依据

`Data/ui/layouts/playerlist_playerinfo.xml` 的 `btnAddFriend` 与 `btnRemoveFriend` 共用源矩形 `[3,194,84,236]`；删除按钮初始隐藏，源图片分别为 `jiahaoyou` 与 `shanhaoyou`。`playerlist.xml` 提供 `FriendTab`。

供给的 `CDTank.exe` 中，`0x4eeb16` 加载 `PlayerListSheet/btnAddFriend` 并保存于对象 `+0xf0`，`0x4eeb50` 加载删除按钮并保存于 `+0xf4`。`0x4ef717` 与 `0x4ef727` 分别设置文本资源 `0x129` 与 `0x12a`。

最小请求路径经静态反汇编确认：添加 thunk `0x4f2506` 将选定目标 `this+0x54` 交给 `0x48b951`，后者检查自己、目标查找、重复和两个容器总量，构造请求后调用 `0x413ec4`。删除 thunk `0x4efe77` 将目标 `this+0x2c` 交给 `0x48b31f`，后者构造目标 ID 与操作字节 `1` 的请求并交给同一发送入口。原确认/提示路径 `0x4f297c` 使用重复查询与添加 thunk，`0x4f281d` 使用删除 thunk。可复核字节与指令保存在 `recovery/output/friends-source.json`；此证据为静态检查，未声称执行原回调。

## 验收

`tests/friends-network.cts` 使用实际 index 服务器与 WebSocket 客户端，3207 端口，通过正常认证、命名、建房、离开和断线接口验证成功与拒绝、单向隔离、幂等、多连接状态、离线添加、昵称更新。服务器实际 SIGTERM 退出再启动同一 SQLite，关系恢复；再直接打开账户存储验证原 368 字节及两个资料字符串保持原值。证据为 `recovery/output/friends-network.json` 与 `.log`。

## 已知边界

原服务端好友规则与双向批准行为未恢复；本接口明确重建为单向列表。原客户端 `0x48b9ae` 比较 `this+0x20` 与 `this+0x2c` 的和是否 `>=64`，`0x48b9b1` 跳至拒绝路径；两个容器身份尚未确认，不能将该总数认定为独立好友上限。生产接口未据此推断好友上限。
