# 队伍聊天服务端（M6-08-T）

队伍频道使用当前连接对应的玩家、所在房间及最新队伍判定资格。团队模式1/2/3支持；个人模式4/5拒绝。普通 RoomChat API 与旧 MsgChat 共用 World.chat 和 rooms/transport 路由，发送者也收到同队消息。公共频道保持同房成员广播。

## 正式接线

- World.chat 查找当前权威成员，channel1要求模式1/2/3及team0/1。
- rooms/chat 接受channel0/1，沿用72个UTF-16代码单元、空白和控制字符资格；公共消息为 `Name: text`，队伍消息为 `[队伍] Name: text`，RoomEvent.value分别为0/1。RoomChat成功响应字段保持roomId/playerId/message。
- rooms/transport 每次广播读取当前room snapshot，队伍消息只选择当前同房session且对应snapshot玩家与发送者同队的连接。准备换队后立即使用新成员关系；PLAYING仍沿用现有禁止换队资格。
- 失败不广播。聊天没有库存、账户、技能、战斗或胜负写入。

## 来源与范围

原界面的队伍入口及72长度依据沿用chat-channel-source.md。channel0/1、模式资格、队伍标签、按当前队伍路由与API接受确认都是重建规则；原服务端已缺失，不将这些规则称为原协议恢复。完整M6-08父项与其他频道不由本片关闭。

## 专项验收

`npx tsx tests/team-chat.cts` PASS：正常World创建/加入/离开，团队模式1/2/3成功、个人模式4/5拒绝；公共格式、非法频道、空白/控制字符、72成功/73拒绝；缺席及离开成员拒绝；固定时钟前后快照证明聊天不修改战斗状态。结果team-chat-rules.json。

`npx tsx tests/team-chat-network.cts` PASS：专用实际服务3186和四个真实账户客户端，正常CreateRoom/Join/ChangeTeam/Ready操作；同队含发送者、敌队和异房隔离；换队前后接收者更新；WAITING进入PLAYING仍可聊天；旧MsgChat队伍与无效频道沿相同路由；个人模式4/5拒绝；公共频道与72边界。共12条接受消息、22次连接消息交付、8次业务拒绝，另验证未入房NOT_JOINED与战斗中换队拒绝。各消息在下一两次正式snapshot后确认未发给其他连接，无位置/生命/结果注入。结果team-chat-network.json/log，运行结束3186已释放。

类型检查PASS：team-chat-types.log。主agent负责两侧构建、边界、公共聊天回归与真实网页验收；本服务端专项不代替页面显示、草稿保留、快捷聊天、高清或输入隔离验收，不重复无改动的CPU两局/账户重启基线。
