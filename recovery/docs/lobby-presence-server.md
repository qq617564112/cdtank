# 大厅当前成员查询

`registerLobbyPresenceApi(server, accountByConnection, sessionByConnection)`注册`LobbyPlayers`查询。请求为空对象，响应为`{players:{accountId:string;name:string}[]}`。每次查询读取真实在线连接，仅保留已认证且不在任何房间的连接，按完整账户ID去重并以账户ID字符串升序排列。同账户有多个连接时，只要其中一个仍在大厅，名单就保留一条。

名字使用与大厅聊天一致的服务端别名`坦克手-${accountId.slice(0,6)}`，不接收客户端姓名，不猜原profile字符串索引。响应仅包含账户ID与别名，不包含token。未认证返回`ACCOUNT_REQUIRED`，房间内查询返回`LOBBY_PLAYERS_IN_ROOM`。模块不写持久数据、不改World或房间规则，也不添加认证/入房回调包装；网页轮询是明确的显示适配。

协议由现有`npm run protocol:generate`生成，相关严格TypeScript检查通过。`npx tsx tests/lobby-presence-network.cts`通过：正式index入口和3199临时服务器、五个真实WebSocket连接及四个账户，八次名单对照覆盖大厅与房间资格、同账户双连接、正常Join/Leave、断一份另一份仍在、全部断线及新账户隔离。结果与日志保存在`recovery/output/lobby-presence-network.*`；专属服务器和临时数据库已清理。

## 来源边界

成员资格、账户别名、查询协议与网页轮询属于重建规则。此名单仅表达当前大厅账户，不代表好友、私聊资格或原大厅服务器协议；浏览器真实显示由对应网页验收覆盖。
