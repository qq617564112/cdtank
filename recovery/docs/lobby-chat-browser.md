# 大厅公共文本业务

M6-08-L 正式大厅沿现有 GameConnection 认证连接发送 ReqLobbyChat。React 持有输入与 pending，LobbyChat 外部状态只在消息/请求/进出房/断线变化时通知；Babylon 每帧更新不驱动该页面。服务器从账户绑定取得身份，进程内消息编号与大厅广播为会话状态，不写账户库存或对局记录。

正常中文输入→Enter→服务端资格→唯一确认/两个大厅页面相同身份全文→普通地图选择/建房→WAITING 隔离大厅消息→普通源关闭离房→清空旧日志草稿/大厅再次发送→真实服务断线清理，已通过实际网页验收。普通 Enter 持键只发一笔；CDP 的真实 composition 流程在候选 Enter 不发送，提交后普通 Enter 正常发送。空文本显示拒绝并保留草稿；服务端未认证、在房间、长度、控制字符拒绝与断线重新认证由真实网络专项验证。

命令：`node --import tsx tests/browser-lobby-chat.mjs`、`npx tsx tests/lobby-chat-network.cts`。证据：`recovery/output/browser-lobby-chat.json`、同名 log、`browser-lobby-chat-formal-lobby.png`；服务契约与独立网络结果见 lobby-chat-server.md。双页面 1920×1080，独立3199/5359/9559，正常网页/鼠键/CDP输入；只读解码真实请求与消息，无位置、伤害、事件或胜负注入。专属服务/浏览器/临时目录正常清理。

## 范围

公共大厅服务资格、账户短别名、消息ID、TSRPC协议与72码元限制均为明确重建规则。原大厅频道/原账户昵称生产链、好友/密语/GM、源字体最终像素和完整1:1精度仍未恢复。原 chat.xml 框内坐标用于正式输入与日志，中文输入使用浏览器原生控件；CDP composition证明浏览器guard，不替代目标操作系统输入法验收。大厅聊天不要求账户消息重启保存；账户/CPU两局/道具与已完成效果基线未改，直接引用有效证据。
