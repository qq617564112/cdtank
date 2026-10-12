# 客户端房间联机模块

E-03将ListRooms/ListMaps、CreateRoom/Join、Ready/ChangeTeam/Cpu/Autopilot/Rematch请求收拢到network/rooms.ts。RoomConnection与AccountConnection共用Battle的同一已认证WsClient，不创建第二条连接。目录请求复用ensureConnected；对局操作在既有连接上发送相同协议，保持错误文字。

创建和加入返回原API结果，由Battle先核验会话编号，再处理错误或进入房间，保留退出后延迟回包门禁。Battle继续拥有资源载入、准备就绪条件、局号/阶段检查、按键清空与画布焦点；网络模块负责请求组装后的传输和确认错误。无需第二份房间/玩家状态。

验收覆盖正常网页准备/取消/双向换队/返回，正常CPU一键创建/加入/失败重试/资源就绪/准备及返回，装备账户操作/隔离/刷新重启/1080p4K预览，以及CPU五模式各两局与正式构建/类型/运行依赖边界。原房间界面与服务端开始政策继续按M2/M5验收，结构迁移不增加原规则一致性结论。

本片以上验收均通过。日志为engineering-room-client-{browser,entry,equipment,cpu,build,types,boundaries}.log，正式运行依赖覆盖181模块。Battle现552行；进一步对局与渲染职责拆分仍属于E-03。
