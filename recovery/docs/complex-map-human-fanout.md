# M7-03 最大真人连接扇出

正式入口 `npm run test:server:human-fanout` 复用编译服务计时器和复杂地图驱动。12个普通空Account分别Create/Join同一mode5/map20，源max12和原180秒规则，正常Ready与Autopilot，普通默认2001；没有CPU、账户资金/拥有物/库存导入或活跃状态注入。

观察60秒，11个同伴端分别与房主同tick核对players/match，全部12端记录服务器及墙钟快照间隔、开火/命中事件，按既有World50ms/servergap150ms门槛判定。12次普通Leave后核ListRooms无孤房，服务及临时SQLite回收。全26图CPU演员负载证据直接复用。

12端完整快照按client0..11分别保存，summary只引用文件，避免V8单字符串长度限制。生产服务器未改。

## 限定范围

本片只有map20/默认2001/普通Autopilot的12账户网络扇出，不能替代全部地图12真人、全部技能、真实独立硬件高清帧率与原伤害政策。完整M7-03父项保持开放。

## 证据

专属驱动最终严格类型 `human-fanout-driver-types-final.log` exit0。完整raw `server-complex-map-human-fanout-2026-10-05T00-46-53-238Z.json` PASS，实际观察60249ms；11peer均1201共同tick一致，World峰36.04ms/p95 15.06ms/1249样本，12端最大servergap52ms/wallgap95ms。12端观察窗口内516项事件的完整payload及顺序相同（按normalLeave前eventCounts确定前缀），后继raw保留离房过程中不同成员范围的正常事件尾段。12普通Leave、临时房间清除、service/tmp清理通过。正式scope索引 `complex-map-human-fanout-accepted.json`，生产server没有新改。
