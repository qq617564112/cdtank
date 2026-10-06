# M5-02-N 建房人数上下限

玩家在正常建房面板选择模式、地图和开局人数/房间容量。地图切换恢复当前地图的原下限及容量；非法范围保留输入并提示，不提交创建。服务器单独存储房间范围，不改原地图目录。加入、CPU、快配、队伍容量、开局/再战门槛与目录/快照使用同一已确认设置。

## 来源

原createroom.xml包含btnDecLowBound、btnIncLowBound、btnDecHighBound、btnIncHighBound和txtLowBound、txtHighBound，证明人数范围原界面功能存在。原地图表PlayerMin/PlayerMax及现有sourceMinPlayers/maxPlayers提供默认值。原按钮回调、允许步长/队伍人数偶数要求、原服务端开局权限未恢复；本片采用整数sourceMinPlayers≤minPlayers≤maxPlayers≤地图maxPlayers的重建规则，不伪造来源。全准备自动开局和队伍容量ceil(max/2)沿用现有重建策略。

## 边界

正式人数校验归server/rooms/player-limits；RoomState存房间设置，World只编排。协议字段可选追加保持旧创建调用默认行为，原地图定义与账户没有新增持久字段。客户端lobby/room-player-limits与room-controls负责草稿读取/范围提示，Battle仅传请求；等待面板及目录显示权威人数。满房CPU拒绝在相同权威名单的后续快照中保留可见提示，直到下一次操作或房间状态改变；按钮恢复可操作，拒绝不新增角色。房间是临时状态，不承诺服务重启恢复房间。

类型/相关规则、实际网络拒绝/准备门槛、正常双网页及1080p4K操作不可互相替代；集成后五模式CPU两局、账户网络保存与两端发行构建保护已有基线。原完整布局36控件、友伤/阵营/完整原权限仍留父项及UI-07。
