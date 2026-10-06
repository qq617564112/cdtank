# M7-04 实时双端自然两局

`npm run test:server:mode-rounds` 连接实际编译服务，顺序覆盖mode1/map7、mode2/map2、mode3/map2、mode5/map20。mode4/map7直接复用 `browser-account-autopilot-hd.json` 正常双网页自然两局与再战，不重复执行。

两普通空Account默认角色、两个普通CPU ADD/CONFIGURE，原人数、时限、生命和玩法规则保持。正式Autopilot/Ready建立自然战斗；本轮不导入账户资金、拥有角色或库存，不修改活跃位置、HP、结算和时钟。CPU有限临时库存沿现有明确重建政策。

每局所有共同tick的players/match逐值相同，事件完整payload与顺序相同。自然终局后1秒结果冻结，双History各自player result与冻结结果相符且matchId相同。首Rematch票不重开，两票开启下一局，旧round票拒绝；第二自然局后正常双Leave、无孤房、service和临时SQLite回收。

证据逐端JSONL gzip流式保存全快照及事件，summary保存源配置、首末快照、共同tick、实际时长、事件计数和历史。驱动最终严格type检查 `mode-rounds-driver-types-final.log` exit0。

## 限定范围

一张代表地图的每模式实时联机流程不代替全地图、独立物理设备或HD性能。当前模式、伤害和CPU政策的可操作一致性不证明原服务端权威恢复。原完整M7-04父保持开放。此片不重复M7-03单服务严格性能测量，可与普通UI首次验收并行，不作为节拍stress证据。

## 当前结果

四个新增模式的八局均通过，原始摘要 `server-mode-rounds-consistency-2026-10-05T01-09-45-730Z.json` 与完整双端JSONL gzip已保存。有限验收索引为 `mode-rounds-consistency-accepted.json`。

| 模式/地图 | 第一局实际秒/共同tick | 第二局实际秒/共同tick | 自然终局 |
|---|---:|---:|---|
| 1/7 | 300.271/5983 | 300.211/5982 | TIME_LIMIT |
| 2/2 | 99.947/1968 | 48.192/952 | OBJECTIVE |
| 3/2 | 4.410/87 | 4.410/88 | OBJECTIVE |
| 5/20 | 180.252/3588 | 180.200/3588 | TIME_LIMIT |

八局全部共同players/match与完整事件payload顺序相同；冻结一秒、双History结果/matchId、首票门禁、旧round拒绝和八次正常Leave/无孤房均通过，服务和临时SQLite已清理。
