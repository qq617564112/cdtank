# 等待房间确认退出（M5-03-X）

原room_main.xml的btnClose注册0x50c165，直接调用0x42704e；场景3发送0x3a9e，原包中的身份由原profile取得，没有本地hide或确认框。完整原指令执行见waiting-room-exit-source.md/json。原服务端处理与响应后的UI时序仍未知。

Web使用显式重建Leave RPC：请求roomId和round，由当前会话确定玩家；未加入、异房、旧局或玩家已不存在均拒绝且不移除。成功使用与断线相同的World.leave/rooms/departure生命周期，删除房间会话、广播退出事件和最新名单，保留账户认证。CPU管理仍仅原有creator权限，不新增房主转移规则。

RoomConnection只管理请求；Battle.exitRoom合并重复点击并在确认后清RoomFeed/输入/地图/模型/效果/音频/HUD/聊天。成功回调由大厅room-controls恢复正常入口并刷新目录；服务器拒绝保留画面和成员状态。断网时走现有本地清理恢复路径。原等待btnClose与外层退出共用业务；Escape仍仅暂收面板，是明确的Web查看界面行为。

正式服务端入口rooms/leave独立注册，shared仅请求响应协议；未引入取证依赖。新增协议通过tsrpc-cli生成，既有服务ID保留。该片不改变生命、伤害、道具消费、账户事务或特效资产，复用已有效的自然两局及账户保存基线。

必要验收：test:rooms:leave真实网络（未加入/旧局/异房/重复拒绝、准备移除、creator离开无新管理人、同认证重入、末位真人退出删除CPU房）；test:rooms:leave:browser真实页面退出/peer更新/重入/原图片矩形与1080p4K。相关waiting规则、全仓类型、运行模块边界与两端构建。所有原服务端规则与Web响应清理均明确重建，不以此关闭完整M5-03/M2-12。
