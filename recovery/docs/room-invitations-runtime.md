# 等待房间招募业务（M5-03-V-B）

原btnInvite绑定50c127，调用48b55c后禁用控件；完整原指令验证3d94只有本机身份，无目标字段或选择界面。额外人数与角色记录门槛见waiting-room-invite-source.md/json。原服务器接收、广播范围及响应仍未知，M5-03-V完整范围不勾选。

重建规则：已认证WAITING真人请求当前roomId/round，服务器用会话确定身份。未加入/异房/旧局/非WAITING/满员拒绝；发送给当前已认证且未加入房间的连接，未认证和在任何房间的玩家均不接收。30秒通知时效与发送冷却均为重建参数，无大厅接收者明确拒绝，通知只含原有公开RoomSummary和发起者名字，不含密码/hash/token。

接收界面是重建大厅招募卡片，并非宣称恢复原接收布局。最多保留五份，替换同房旧卡片；忽略只删卡片，接受调用同一Battle.join，密码遮蔽，拒绝保留卡片与密码字段焦点。过期请求不发送，房间已关闭/满员/对局开始由普通Join权威拒绝；不会绕过密码、自动离开现有对局或给好友授权。进入任意房间清所有卡片，主动退出沿现有确认生命周期。

正式模块：rooms/invitations注册API/收件会话门禁，shared新增协议，network/rooms请求；Battle仅协调请求/消息，WaitingRoom绘制源Invite控件与忙/冷却状态，interface/lobby/room-invitations管理大厅卡片，room-controls接普通Join。取证脚本只在recovery/evidence，未进入生产依赖。

必要验证：test:rooms:invitations真实多连接门禁/隔离/成功/密码加入/重复/满员/失效与无人接收；test:rooms:invitations:browser真实网页原Invite鼠键/图片矩形1080p4K、通知忽略与密码加入/名单同步。全仓类型、运行依赖边界、两端独立构建。该片不更改战斗、账户事务、CPU或资产，复用有效连续两局与保存基线。
