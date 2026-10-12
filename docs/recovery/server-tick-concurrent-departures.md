# 多房离场结算与服务端节拍

20个合法map7/mode4房间、40个普通空账户连接使用默认角色与普通持续2001输入。19房同时正式Leave时，余房继续运行。账户数据库采用WAL日志和FULL同步；正式Leave按到达顺序执行，在相邻请求间让出事件循环。每个请求仍在现事务完成后确认，房间和局资格在执行时校验，快照与事件顺序保持现合同。

|同一退出突发负载|最大快照间隔|正常Leave|
|---|---:|---:|
|原回滚日志与连续执行|360ms|40|
|WAL FULL与请求间让出事件循环|63ms|40|

最终World单步最大7.082ms，150ms节拍上界通过。server-tick-concurrent-departures-accepted.json列出原始捕获、CPU profile及限定门槛。profile由专属入口测量，不进入生产运行。server-tick-profile-network.cts --finish-burst --verify-timing通过同一负载门槛；无活跃位置、生命、事件或时间注入。

战绩事务原子性、失败回滚、重复结算幂等、账户隔离和关闭重开通过account-history检查；普通网络结算/断线账户身份、真正服务进程重启与战绩恢复通过account-history-network；room-leave-network保留资格拒绝、身份与正式离场基线。服务端类型与独立构建通过。

## 范围

本片关闭明确的并发正式Leave节拍缺环。全部最大人数复杂地图、运动/技能并发和全局超时结算突发未由本负载验收，M7-03父项保持开放。角色取得和原战绩/服务端政策沿既有边界，默认角色路径不作为正式购买证据。

SQLite实时数据包含主数据库及其WAL文件。关闭数据库后再复制单文件，或使用SQLite备份机制取得运行中一致副本；不能只复制运行中的主数据库作为完整存档。

## 同时断线

`server-tick-profile-network.cts --disconnect-burst --verify-timing` 同20房40普通账户负载下，19房38连接同时断开，余房继续运行，最大快照间隔149ms、World单步最大7.139ms，150ms限定门槛通过。权威目录确认19房删除；38账户使用原token重新认证后，各取得唯一FORFEIT战绩，同一局两个账户使用相同matchId。余房两连接正常Leave成功。现有生产离场与结算实现满足这次负载，没有新增调度或规则。

原始结果为 `server-tick-profile-2026-10-04T21-11-09-066Z.json`，CPU profile和World测量同stem；范围索引为 `server-tick-concurrent-disconnects-accepted.json`。这次恢复的是账户身份和已保存历史，不是原房间重入。M7-06原掉线重入/判负政策与M7-03最大复杂负载仍开放；真实进程重启历史恢复沿用既有account-history-network证据。
