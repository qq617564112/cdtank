# 地图 7 普通环境物件网络验收

真实 index 服务器网络验收通过。`environment07-network.json` 记录地图 7 歼灭模式、正常两账户及四 CPU 的 90 秒自然战斗：295 次自然 fire，四个 ENV 物件受损，其中一个完整破坏；双方接收一致，正常 TIME_LIMIT 结算、再战恢复和房间隔离通过。

`tests/environment07-network.cts` 使用独立端口 3213、临时 SQLite、三个 WebSocket 客户端。通过正常 Account、CreateRoom、Join、ChangeTeam、CPU、Autopilot、Ready 开局，两账户分别在两队，四 CPU 加入后六位参与者正常战斗。客户端使用已有心跳保持连接。无位置、伤害、状态、事件或胜负注入。

| 结果 | 实测 |
| --- | --- |
| 初始环境 | PLAYING 构造 10 个 ENV，全部 HP200，与 gameplay objectives 分开 |
| 双端一致 | 1783 份共同 tick/phase 的 ENV 快照一致，全部 sceneObjectHit/sceneObjectDestroyed 事件一致 |
| 自然损伤 | ENV38（obj05466）HP157、ENV39（obj05466）HP0、ENV45/49（obj05468）HP157 |
| 完整破坏 | ENV39 hit 累积200，sceneObjectDestroyed 唯一一次 |
| 目标规则 | objectives 列表为空，所有玩家 objectivesDestroyed0；自然结算 reason TIME_LIMIT |
| 正常再战 | 两账户正常 Rematch 投票后 round2，10 ENV 均 HP200、无 destroyedAt |
| 隔离 | 第三账户在大厅，整个过程没有收到该房事件；两账户正常 Leave |

初始、结算、再战完整 snapshot、ENV 事件、损伤记录及 Leave 计数保存在 `recovery/output/environment07-network.json`，服务器日志为 `.log`。生产逻辑和网页未修改。

## 已知边界

网络保存的有效证据证明 ENV 与目标计数、终局条件分离。玩家 score 包含正常玩家战斗所得，最终分别为 102、164、128、70、164、132；本次未保存用于逐 tick 因果积分对账的全部非 ENV 事件，不宣称逐 tick 的 ENV 积分增量实测。既有 `damageSceneObject` 只修改 ENV HP 并产生环境事件，积分路径由玩家伤害规则处理。

本次网络自然破坏覆盖 obj05466，损伤覆盖 obj05468；未将未自然命中的 obj05467 声称为实际命中证据。源实例与三族视觉验收采用独立证据。本轮仅模式1/map7；不推定其他模式的网络验收。

## 清理

正常断开三个客户端，关闭测试服务器，移除临时数据库目录。交付时 3213 无监听进程。
