# 大厅在线成员业务

正式大厅右侧名单查询服务器当前认证连接，不在房间的账户显示一次；同账户多个连接只要仍有一个在大厅就保留。普通建房/加入从其他大厅移除，Leave重新加入，全部连接断开后移除。服务器仅返回账户ID和确认别名，未认证与房间连接拒绝查询。

LobbyPresence由现有GameConnection共用认证transport，独立于World/Babylon时钟。React外部store只在名单或载入/错误变化时通知；每秒查询限一笔，仅大厅/可见/连接有效时更新，返回大厅立即查询。进出房、断线、卸载和场景销毁递增会话代号丢弃迟回复；断线清列表和选择，普通浏览器刷新恢复既有账户。无服务器角色位置、伤害或事件注入。

真实网络验证5连接4账户、8次名单对照，涵盖同账号去重、房间资格、Join/Leave与断线保留/移除。真实双网页验证正常认证身份、35辅助普通账户扩为37成员、三分辨率源矩形/原选中资源/普通滚轮与End、入房移除及选中清理；定向生命周期续段验证源Leave返回同身份不恢复旧选择、普通reload、真实停服列表清空与可见状态。

验收索引`recovery/output/lobby-presence-accepted.json`保留首run整体FAIL与完成的三scope、续段整体PASS。首run在建房弹窗尚未关闭时尝试打开等待页，生命周期续段明确等待建房dialog关闭再普通点击，未改变生产门禁。三实际截图为browser-lobby-presence-{800,1080p,4k}-selected.png。两次独立3200/5360/9560与辅助连接/临时目录均正常清理。

命令：`npx tsx tests/lobby-presence-network.cts`、`node --import tsx tests/browser-lobby-presence.mjs`、定向`node --import tsx tests/browser-lobby-presence-lifecycle.mjs`。源区域及字体/选中与滚动边界见lobby-player-list-source.md，服务资格见lobby-presence-server.md。

## 范围

账户短别名、同账户去重、稳定排序及每秒查询都是明确重建规则。原服务成员协议、原昵称生产、好友/密语、完整滚动栏/字体光栅/Windows GPU精度尚未恢复。名单为会话状态，不写账户事务。共同战斗规则、CPU连续两局和持久库存未改，引用有效基线；本轮只统一检查相关协议/模块与发行入口。
