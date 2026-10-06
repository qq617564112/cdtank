# 房间邀请浏览器验收

结果：PASS。运行 `node --import tsx tests/browser-room-invitations.mjs`，使用独立3198服务、5231 Vite、9301 Chromium和两个独立认证网页。

等待室原btnInvite使用真实鼠标发送RoomInvite(roomId,round)，服务向已认证且仍在大厅的网页发送RoomInvitation，房内发送者不接收招募卡。通知仅含房间公开摘要与密码房标记，不含房间密码。原room_main.xml控件矩形、btnInvite图片引用及PNG解码在1080p/4K均通过。

大厅原生Tab/Enter忽略招募卡不发送Join。密码房招募卡使用遮蔽输入；错误密码通过普通Join得到ROOM_JOIN_REJECTED，保留卡片、草稿及密码焦点。修正密码后普通Join成功，招募卡清空，两网页收到同tick两人权威名单。无大厅接收者的真实邀请请求被拒绝并保留WAITING面板和可用邀请动作。普通离房返回大厅并清空邀请卡。

30秒冷却绑定认证连接，创建新房仍须等待；脚本在第一次成功邀请的expiresAt之后发送第二次招募。证据见 `recovery/output/browser-room-invitations.json`、同名服务日志及1080p/4K截图。服务与Chromium退出、Vite关闭、临时目录删除均通过。
