# 账户真实对局记录（M6-05-H / M5-15-H）

玩家从正常“我的对局记录”入口查询本人账户保存的服务器结算。正式服务器冻结结果时捕获参与者身份，保存模式、地图、局号、结束时刻/原因及本人排名、击杀/死亡、目标数、战斗分/结算分/总分和胜负。服务器结果与玩家原样绑定，客户端只有查询入口，不能上传胜负或修改记录。

## 接线与身份

`World.finishRoom → onMatchCommitted → settlement/history.accountMatchHistory → AccountStore.recordMatchHistory → accounts/history.AccountHistory`。结算先经既有finishRound一次提交和冻结，再传独立副本；回调在离场名单删除之前执行。普通断线处理先经World.leave判负并保存，随后删除accountByConnection映射；CPU不写人类账户，真实玩家托管仍写该玩家账户。每次服务启动随机UUID+roomId形成matchId，round区分再战，避免重启后复用R6/round1造成重复或误丢弃。

存储为全部匹配账户的原子SQLite事务：ledger `(matchId,round)` 幂等，单账户记录唯一。任一账户缺失/同一账户重复绑定冲突导致整场回滚，ledger不留下假成功。失败payload保留当时账户与结果副本，固定tick重试，第一次错误明确日志报告；连接身份删除不影响重试。当前待重试队列为进程内状态，数据库持续不可写期间强制终止会丢失尚未提交的记录，不宣称该故障跨崩溃恢复。正常已提交记录支持真实服务重启。重复账户多连接参加同场的业务资格和历史投影尚需定义，当前不可当作完整多会话社会规则；M6-05父项保留。

`History` API仅按服务器账户映射查询，offset非负整数/limit1–50，默认20条，按结束时间与稳定key降序，无客户端accountId参数。现有账户唯一联机运输接入`AccountConnection.history → Battle.history → interface/account/AccountHistory`。正常窗口提供空/加载/失败重试、关闭再开、前后分页和刷新。关闭失效代号阻止迟到请求重开窗口。真实页面首次复验发现旧close事件排队后在快速再开时取消新查询，已修复为只在窗口仍关闭时递增代号，保留新open请求。窗口文本安全textContent，不生成HTML。

## 来源与重建边界

既有模式胜负、计分及服务器判负规则明确为重建规则；这里保存已有冻结结算，不创造经验、货币、等级、称号、勋章或原QQ字段。源地图bonus仍是现有结算输入，不等同货币奖励。新账户不免费赠送物品。本入口为重建窗口，不冒称原布局还原。

原`history.xml`的10控件包含rdoTuntown/rdoCharacters/rdoCompany/rdoStaff和edtMainText，实际为背景/人物/公司/制作人员介绍；该原窗口内容和事件留UI-23，不能用当前战绩列表代替。本片不关闭M6-05完整称号资料/M6-02成长奖励/M5-15通用弹窗父项。

## 验收与失败定位

- account-history.cts：保存任一参与者失败必须全回滚/可重试，重复不重复、账户隔离、真Store关闭重开与分页；失败修accounts/history持久模块。
- account-history-world.cts：正常Ready/本人Autopilot与三CPU普通输入自然连续两局，逐局保存本人精确冻结结果/CPU不写/旁观账户空/重复finish不重复/重开恢复；独立数据库显式存储故障只中断写入，验证账户映射删除后待重试仍能提交。禁止战斗生命/位置/结果注入。
- account-history-network.cts：真实3157三账户、未认证和非法分页拒绝；普通Ready后真实退出判负同时保存离场人和留场人，旁账户不可见；实际服务重启后精确恢复，再用重启复用房号保存另一场不冲突，实际offset分页。失败修正式身份捕获、disconnect顺序或协议/API。
- browser-account-history.mjs：正常页面使用上述自然两局数据库的持久账户，查询/关闭再开/刷新/真实服务停止失败提示/重启重试/页面刷新保持实际记录；1920×1080和3840×2160。另隔离component callback仅验加载取消/分页操作，标actualServerRecords:false，不能代替真实服务器记录。

运行命令与实际PASS证据原位列在tasklist。结算回调跨共同生命周期，集成后只统一执行一次必要CPU五模式两局、账户网络重启、类型/正式两侧构建、模块依赖边界。特效未改，复用本轮effect-cleanup-delivery六项PASS及已有真实资源声音证据。

最终验收全部PASS：account-history-final-suite.log及模块/自然两局/真实网络JSON；browser-account-history-populated.json和empty.json及对应1080/4K截图（各真实服务器重启、查询失败重试、刷新/关闭再开，component分页单独标识）；account-history-{cpu-two-rounds,account-network,types,boundaries,build-server,build-web}.log。Web1m22s/244运行模块。M6-05-H与M5-15-H已勾选，父项全称号/奖励/资料及原页面仍未完成。
