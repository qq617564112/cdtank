# 玩家查找

正式大厅的 Web 采用持久账户精确昵称查找：玩家在大厅入口提交昵称，服务端在持久账户上做全等匹配，返回复用好友投影的最小公开记录，选中候选打开同一资料页并接既有关系业务。原查找界面、原查找通信字段与原服务端匹配规则均未恢复，本路线为 Web 采用。

## 采用规则

匹配键为账户的有效昵称：优先已保存的 `account_display_names.name`，否则使用默认昵称 `坦克手-<accountId 前 6 位>`（`AccountDisplayName.get`/`find`）。查询对输入先 `trim`，再与有效昵称全等比较，既非前缀也非模糊，不折叠大小写；命中按 `accountId` 升序返回（`find` 的 `COALESCE` 与 `ORDER BY a.id`）。

输入约束沿用昵称规则：空串、超过 16 个 Unicode 码元或含控制字符 `\u0000-\u001f\u007f` 拒绝。昵称本身仍为去首尾空白后的 1 至 16 字（`AccountDisplayName.set`）。

同名：多个持久账户有效昵称相同时全部返回，页面逐条列出；每行以 `#<accountId 前 6 位>` 消歧，该标签不参与匹配。

离线与在房：查找覆盖全部持久账户，不要求在线。`online` 为存在该账户当前认证连接，`inRoom` 为其任一认证连接当前有房间会话；离线结果 `online:false`、`inRoom:false`，页面分别显示 `离线`、`房间中`、`在线`。

自己：查找不排除发起者本人；发起账户昵称与查询相同时自己也在结果中。这与好友 ADD 的自己拒绝不同，查找不做 owner 过滤。

## 认证与错误

未认证连接返回 `ACCOUNT_REQUIRED`（“请先登录账户”）。无效输入返回 `PLAYER_SEARCH_NAME_INVALID`。空结果为 `players: []`，页面显示 `未找到玩家`，不是错误。查询失败保留错误信息与重试入口；对话框内一次提交只保留最新请求结果，进行中禁用提交与关闭。

## 公开字段

每条结果为好友投影的最小记录：`accountId`、`name`（`accounts.displayName`）、`online`、`inRoom`、`title`（`accounts.currentTitle`，未佩戴时省略）。页面只渲染昵称、`#id` 标签、在线状态与标题名；不返回或展示 QQ、家族、描述、库存等私有资料。

## 界面到关系业务路线

`查找玩家`（`lobby-player-search-launcher`/`PlayerSearchView`）→ `AccountConnection.playerSearch` → `Battle.playerSearch` → `PlayerSearch` RPC → `registerPlayerSearchApi` → `AccountStore.playerSearchIds` → `AccountDisplayName.find`。

选中候选后 `LobbySocialView.openFromSearch` 设为目标并打开 `PlayerInfoView`；资料页经 `PlayerProfile`（`battle.playerProfile`）读取目标公开资料，其 Add/Remove Friend、Blacklist、Exchange 分别接既有 `Friends`、`Blacklist`、`Trade` 业务。查找只负责确定目标，关系写入仍走既有权威模块；关闭资料返回 `查找玩家` 入口。

## 来源

本查询为 Web 采用：不存在已恢复的原查找界面、原查找通信字段或原服务端匹配来源。原 `playerlist.xml` 提供 PlayerTab/FriendTab/PlayerList 与资料页控件，未提供独立查找框或查找按钮。

原客户端 Add/Remove 路径（`friends-source.json`：Add thunk `0x4f2506` 取已选目标 `this+0x54` 交给 `0x48b951`，Remove thunk `0x4efe77` 取目标 `this+0x2c` 交给 `0x48b31f`）只证明原关系操作以已选 targetId 为目标来源，确认“列表或资料页选中即目标”；它不证明原客户端按昵称查找，也不提供原查找请求/响应字段或服务端匹配规则，因此不得由该事实认定原昵称搜索存在。

实际代码 owner：协议 `apps/shared/protocols/PtlPlayerSearch.ts` 与 `apps/shared/protocols/serviceProto.ts`；服务端 `apps/server/src/social/player-search.ts`、`apps/server/src/accounts/display-name.ts`（`find`）、`apps/server/src/account-store.ts`（`playerSearchIds`）、`apps/server/src/index.ts`（注册）；Web `apps/web/src/network/accounts.ts`、`apps/web/src/match/battle.ts`、`apps/web/src/interface/lobby/lobby-social-view.tsx`、`apps/web/src/interface/lobby/player-search.tsx`、`apps/web/src/interface/lobby/player-search.css`。

## 已知边界

原查找来源未恢复；真实页面双端网络、服务器重启持久化与高清分辨率均未实测。既有好友关系证据（`friends-network.json` 等 QUERY/ADD/REMOVE）仅复用它原有范围，不把旧日志当作新查找的通过证据。
