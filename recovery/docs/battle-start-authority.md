# 统一开战时刻与输入/模拟/HUD门禁

M5-04、M5-05的开场按用户明确规则实现：进入战斗提示播放期间所有坦克不能动；提示全部结束、真正开始战斗之后才推进比赛时间、移动、瞄准、开火和道具使用。规则由用户确认，原服务端producer仍未取得；本批未运行测试、浏览器、构建或类型检查，两条父项保持未勾。

## 权威合同

共享协议`MsgRoomSnapshot.match`新增可选`battleStartsAt?: number`，为服务器毫秒时间，表示本局真正开始战斗的时刻。不新增phase。共享`shared/combat/battle-start.ts`导出`BATTLE_MODE_INTRO_MS=2000`、`BATTLE_FIGHT_INTRO_MS=1000`、`BATTLE_INTRO_MS=3000`，以及`battleIntroStage`/`battleIsActive`：`phase`非`PLAYING`、缺`battleStartsAt`或已到达`battleStartsAt`时阶段为`hidden`；`battleStartsAt-1000`之前为`mode`，最后1000ms为`fight`；活动判定为`PLAYING`且（`now>=battleStartsAt`或该可选字段缺失）。

正式server所有`PLAYING`快照都携带该字段。字段是现有additive snapshot合同的扩展，不另加兼容层。

## 服务器接线

`World.startRoom`在全部真人资源Ready的`LOADING`结束、初始化玩家之后设置`room.startedAt = now + BATTLE_INTRO_MS`。`startedAt`仍为真正战斗时间：`playedSeconds`、结束期限、奖励、装备补给与被动技能时钟都沿该时刻，开场3秒不计入。`roomSnapshot`把`match.battleStartsAt`投影为该值。

`World.step`在`now < room.startedAt`时只递增`tick`并投影快照，跳过整段`simulateRoom`，因此真人、CPU与托管都静止，且开场期间不结算超时。到期判定用`now - startedAt`，`remaining`按该真实差值与`timeLimit`取`clamp`，`startedAt`在未来时保持完整`timeLimit`，不会虚增3秒。首个活动tick只按`min(deltaMs, now - startedAt)`推进，不把前3秒带进运动或占领。

`acceptBattleInput`在普通输入、CPU输入与托管输入共同入口上要求`phase==='PLAYING'`且`now >= startedAt`，否则直接返回空。开场期间不写`player.input`、不接受pose、不推进饮料/迷彩/无敌等状态、不分派道具热键，因此不会留下预开场移动/开火/道具队列。`playerSnapshot`按同一活动判定投影`movement.canMove`/`canTurn`，并把`movement.command`归零；客户自有运动字段（speed/turn/tankType/original）照常保留。

初始化保持原状态：角色在`initializeBattleParticipants`按出生点放置、清空运动状态、满血、状态2、重置分数与库存数量，时间/装备供给/被动技能起点沿真正`startedAt`，不伪造开场进度。准备后`LOADING`不变；每次再战`startRoom`都会重新计算新的`startedAt`，`battleStartsAt`随新局。迟加入/重连从快照读同一`battleStartsAt`，只展示剩余提示，不重播三秒。聊天与离房在开场期间仍可用。

## 验收边界

本批判定依据为规则与代码走查。开场门禁、真实`startedAt`沿结算/时长、`remaining`不虚增、首活动tick的dt、CPU/托管静止、快照运动门禁与再战/重连新时刻尚无实际对局、双网页或重启实测，完整M5-04/M5-05保持未完成。
