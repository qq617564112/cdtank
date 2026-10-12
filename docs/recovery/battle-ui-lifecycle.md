# 战斗界面生命周期接线

范围为死亡、控制切换、结算和断线恢复的操作门禁及姿态呈现，沿当前已采用的WAITING/LOADING隐藏、PLAYING显示、FINISHED保留终值规则。开场的统一`battleStartsAt`合同见`battle-start-authority.md`及`battle-start-client-presentation.md`。

| 状态 | 操作与显示 | 正式接线 |
| --- | --- | --- |
| 死亡 | 手动键盘及八槽停用；清除已按住的移动、瞄准和开火键；死亡姿态取权威快照 | `Battle`输入上下文和`beforeSnapshot`、`BattleInput`、`LocalTankMotion.synchronize` |
| AI托管/人工接管 | 托管期间不缓存手动按键；切换控制时清除旧按键 | `BattleInput`的connected/playing/autopilot门禁及`Battle.beforeSnapshot` |
| FINISHED | 本机预测收敛到冻结快照；所有战车立即落到最终位置和朝向，停止移动动作；最后一次目标/王标记同步 | `LocalTankMotion.synchronize`、`BattlePlayers.render`、`BattleTargets.update` |
| 终局时钟 | 提前结算保留真实剩余时间，时间到期为0；窗口停留期间保持冻结 | `roomSnapshot`使用既有`match.result.endedAt`，沿真正`room.startedAt`计算 |
| 断线恢复 | 八槽立即停用；恢复后按当前已接受的快照重置本机预测，再恢复控制 | `BattleHud.setConnected`及`Battle.recoverRoom`；`LocalTankMotion.resetPrediction`保留地图与碰撞字段 |

真人、CPU和托管在开场期间的服务器冻结及输入拒绝，继续由统一开战时刻控制。聊天和离房沿现有独立流程。

## 原死亡数字

原Countdown图字及客户端死亡通知的1秒间隔、5至1序列来源见`death-countdown-observers.md`、`death-countdown-ui.md`及`death-countdown-player-scope.md`。真实复活由权威`alive`、`respawnAt`及现有服务端复活规则决定。

## 验收边界

本批依据现有源码、快照合同和已记录来源完成接线。未运行测试、浏览器、构建、类型检查或生成器，未新增unit test。原服务端中断/阶段生产规则及完整高清视觉仍待恢复和实际验收；M5-04/M5-05父项保持未勾。
