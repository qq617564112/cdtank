# 正式大厅密语

M6-08-W贯通原大厅频道、对象和内容入口与当前账户权威身份。原chat.xml的btnPublicChannel/btnPrivateChannel、tiao、edtIntimateNameInput/edtIntimateChatInput、btnExpandIntimate及chat_channellist_lobby.xml公共/密语图态实际进入React；原对象空缺提示见chat-channel-source.md。在线名单双击或Enter选账户，展开对象入口聚焦名单；编辑对象名字转为姓名解析。上述操作绑定、菜单放置、姓名解析与服务端路由是重建规则，未恢复原网络频道数值或全部发送接收回调。

LobbyChat持有公共/密语会话、目标、草稿、确认门禁与已接收消息，React管理菜单、IME和焦点，沿GameConnection唯一认证运输。两类消息按频道与进程内序列去重，不因公共和密语同ID丢失消息。进入房间与断线清会话；迟到响应受会话代际隔离。发送期间目标与频道锁定，内容输入保留焦点及编辑，成功只清仍对应本次请求的草稿，失败保留原草稿。挂载时连接，普通发送确认链重新连接，不因清会话反复触发界面主动连接。

服务端对当前大厅连接解析账户或精确保存名。重名拒绝姓名解析，明确账户可发送；自己、在房发送、不在线/无大厅连接、空对象、非法文本拒绝不广播。只向发送方和目标当前大厅连接投递，同账户多连接各一次，房内连接和第三账户隔离。消息为会话数据，不写账户资料或聊天历史库。

## 验收

`npx tsx tests/lobby-whisper-network.cts`真实3203服务6次成功、15次拒绝及公共聊天回归PASS，见lobby-whisper-network.json/log与lobby-whisper-server.md。

正式页面来源与新控件三分辨率证据、中文IME、同名账户选择、唯一姓名、自己/空对象/歧义拒绝、第三网页隔离，以及入离房/断线的范围联合记录于browser-lobby-whisper-accepted.json。每个范围引用实际完成检查；原运行FAIL保持，不以范围联合冒称单次全套PASS。未受改动影响的CPU连续两局、账户库存/保存重启与原资源基线直接引用tasklist既有结果。

## 限制

本片范围为大厅当前在线账户；房间/战斗密语、好友关系与离线消息、原完整富文本及原字体/GPU、原服务器频道语义仍未恢复，M6-08/M5-12/M6-09父项保持未完成。
