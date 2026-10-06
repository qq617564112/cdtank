# M6-08-T 正常队伍聊天

玩家在等待、战斗和结算的正常聊天栏选择“房间”或“队伍”，普通输入与已有快捷文本均使用当前频道。成功消费服务端确认后才清除相同草稿；拒绝保留文字并显示原因。请求期间锁定频道，离房、断线和重入清空日志并恢复房间频道，旧回调由既有generation隔离。

## 原来源与重建边界

chat-channel-source.md保留原ChatPanel/btnTeamChannel、game_main/btnTeam、两份频道列表rdoTeam及72字符输入来源。未取得原数值频道/发送回调/服务器路由。channel0同房、channel1同队、[队伍]标签、仅团队模式1/2/3、每次发送按当前权威队伍选收件人均明确为重建规则，不关闭原频道来源或M6-08完整父项。个人模式4/5允许选择后显示服务端拒绝，不能无声发送给所有人。历史已接收消息不会因后续换队撤销，不持久保存聊天。

## 模块与接线

Web interface/battle/battle-chat拥有原生select[data-chat-channel]、状态及输入生命周期；match/battle转交选择，network/rooms通过既有RoomChat请求发送。shared仅更新已有契约注释，编号及schema未改变。服务端World.chat只读取当前成员并判玩法/队伍，rooms/chat校验文本生成事件，rooms/transport按同房session与当前snapshot的发送者队伍过滤连接。MsgRoomEvent既有value=1标记队伍，value=0公共行为保持；旧MsgChat也走同一资格和广播路径，客户端不能提供发送者/队伍/收件人。

失败假设：跨队/跨房泄漏由transport修复；换队后路由过期由每次读取权威snapshot修复；非法频道/个人模式或无成员由资格入口拒绝；发送失败丢草稿/异步旧回调污染由BattleChat确认/generation修复；输入与选择焦点误触发战斗由既有BattleInput焦点门禁并在选择focus/change清键保护。普通快捷文本保持原防重复、IME/控件焦点隔离和草稿规则。

## 验收状态

已通过客户端快捷文本真实模块测试（team-chat-client.log），覆盖选择频道、pending锁定、拒绝保持草稿、新房默认与旧回调隔离。team-chat-rules.json覆盖模式1/2/3队伍成功、个人4/5拒绝、当前成员/离开、非法频道和72/73字符资格，聊天前后战斗快照保持。team-chat-network.json真实3186四账户12接受/22交付/8拒绝，通过当前换队路由、敌队异房隔离、准备→战斗和旧MsgChat。browser-team-chat.json四个正常网页13项PASS，原生选择/Enter/F5及真实三真人PLAYING队伍/公共消息、焦点隔离、9组pending选择禁用/恢复、正常非空房重入恢复默认0、个人模式拒绝保留草稿、1080p4K布局与七截图。首轮runner错误将全员退出后销毁房当成可重入，修正为保留一名玩家并通过正常FINISHED再入，最终证据PASS；没有改产品房间生命周期。公共聊天网络回归（team-chat-public-baseline.log）、全仓类型/260运行边界/服务发行及Web发行2m28s均PASS（team-chat-{types,boundaries,build-server,build-web}.log）。专用3186/3187/5222/9292与临时数据清理，两个agent停止；M6-08-T已勾选，完整M6-08保持未勾选。聊天无对局/账户数据写入，复用现有CPU连续两局、账户保存和原资源证据，不重复无关完整回归。

命令：npm run test:rooms:team-chat；npm run test:rooms:team-chat:browser。服务端和网页专项边界见team-chat-server.md、team-chat-browser.md；各专项分别执行并收拢，不为组合命令重复已通过检查。
