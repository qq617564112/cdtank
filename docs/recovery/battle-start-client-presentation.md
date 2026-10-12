# 统一开战时刻的客户端呈现与门禁

本片把战斗开场的模式/Fight提示、真人输入与本地运动统一绑定到服务器权威开战时刻 `match.battleStartsAt`，让所有玩家的提示结束与真正推进比赛的时间对齐。规则与快照字段见共享合同 `shared/combat/battle-start.ts` 与 `MatchSnapshot.battleStartsAt`；本片不改协议、服务端、结算或既有 HUD 视觉。

## 统一服务器时钟

客户端不新增独立的 2 秒/1 秒动画计时。`battleIntroStage(snapshot, now)` 与 `battleIsActive(snapshot, now)` 都以本机最新快照的 `serverTime` 加 `performance.now() - receivedAt` 推算同一个服务器时钟：`stage` 在开战前 3000–1000ms 显示模式、最后 1000ms 显示 Fight，到达 `battleStartsAt` 后为 `hidden`；`active` 仅在 `PLAYING` 且到达 `battleStartsAt` 时成立。晚加入或重连的玩家只看到剩余提示尾段，不重新播放三秒。缺失该可选字段的旧快照按已开战处理。

## HUD 阶段显示

`BattleHud` 订阅 `introStage` 快照字段，`HudLayout` 的模式/Fight 遮罩直接读取该阶段，不再使用组件内 `useEffect`+`setTimeout`。相同阶段不触发整棵 HUD 重新通知，只有阶段跨越模式/Fight/hidden 边界才推进快照。场景、标签与静止坦克照常绘制；提示期间不隐藏场景，只为开场锁定输入与模拟。聊天、退出与其它非战斗控制不受本门禁影响。

## 输入、运动与预测门禁

`BattleInput` 的 `playing` 上下文由统一的 `battleIsActive` 判定，键盘移动、转向、瞄准、开火与八槽快捷键在开战前一律不发送、不发送 held 与 use；开战当帧起恢复正常按键。`LocalTankMotion` 增加 `setActive` 门禁，`advance` 与 `reportedPose` 在非活动时返回静止，避免本地预测、上报 pose 或渲染命令在提示期间积累。`combatState` 的 `canUseShortcuts` 同样要求开战活动，使道具栏八槽在提示期间禁用。

HUD 八槽的显示消费者仍是既有 `HudItemSourceView`，`combatState` 接收 `BattleHud.update` 的同一 `serverNow`，提示隐藏与八槽放行沿同一开战时刻。库存、选中弹槽、装填与效果期限仍取权威快照。

## 换局姿态

`BattlePlayers.resetRound` 立即设置每辆已载入战车的位置、车体方向与炮塔方向；异步载入的战车同样以最新快照的完整姿态初始化。开场提示期间保持出生姿态，正式开战后沿既有位置及朝向插值呈现。

## 复用与边界

本片保留主仓库已提交的 HUD 贴边偏移、`battleInfo` 居中、本人头顶隐藏、默认称号/翻转/地图/标签等既有改动，不重做上批已补齐的 HUD；再战换局与离房继续由既有 `clear`/`leave` 路径复位阶段与门禁。`ui-actual.patch` 以主仓库脏源码为基线，仅追加本片差异，供 root 安全集成。

## 待验证

开场静止与统一 deadline、晚加入只显示剩余提示、再战/离房复位及八槽门禁的整页双端表现均未执行；本片按既有范围不新增 unit test/浏览器/构建/类型/lint/生成器运行，上述结论来自源码接线与共享合同，非实测。原规则为用户明确采用，原服务端实现未取得。M5-04/M5-05 父项保持未勾。
