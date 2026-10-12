# 击杀与离场的玩法结果边界

E-02将battle/life中的团队击杀计数、队伍生命消耗和击杀终局条件，以及World.leave中的离场弃权策略收进modes/outcomes.ts。模块直接使用正式模式计数，返回赢家数据；不自行设置房间阶段、发送消息或删除玩家。

battle/life继续处理友军误伤、生命扣减、命中/死亡/击杀分、战斗状态和复活期限，并按原有顺序产生hit/destroy事件。applyModeKill在击杀数更新后处理模式计数：模式1/3增加击杀队伍分，模式1减少被击毁队伍生命；模式1生命耗尽、模式3 VIP被击毁、模式4达到目标击杀数时返回赢家。World伤害回调同步提交结算并产生finish事件，弹丸循环即时读取FINISHED停止。

forfeitOutcome只对PLAYING决策，在删除玩家前读取当局名单。剩余不足两人、团队模式离场方无人继续、或擒王模式VIP离场均保留原弃权策略；团队模式优先剩余敌队，个人模式使用剩余首个玩家。缺少赢家时保留-1/空ID。World先提交包括离场者的冻结结果，再删除玩家和准备/再战票，清除其弹丸，并执行原清房/开局/再战流程。

这些是既有重建玩法政策，不是原服务端规则证据。伤害公式、友军误伤与原完整玩法仍按M2恢复。

## 验收

tests/match-rules.cts补充正常四人准备后的VIP离场分支：非VIP离场继续，VIP离场即使同队仍有人也判负；结果名单包含本次离场者而不含之前离场者；重复离场不改写冻结结果。模式4/5补充双方正常开局、真人离场、个人赢家身份和完整二人结算名单。规则夹具的命中测试使用明确的坐标设置，与无状态注入的CPU自然两局验收分开。

五模式命中/冻结/再战、26模式地图房间、原地形碰撞/复活、自然治疗与CPU普通施放、构建/类型、189正式可达模块边界均通过，日志engineering-mode-outcomes-{build,match,rooms,terrain,healing,types,boundaries}.log。编译真实联机重启保存与CPU五模式各两局、正常网页资源失败重试/准备/实际渲染运动/退出也通过，分别记录engineering-mode-outcomes-compiled.log和engineering-mode-outcomes-browser.log。

## 剩余工程范围

World仍需拆房间生命周期、账户到战斗准备配置和普通输入接受。index仍需拆拥有战车解析/绑定、聊天断线、广播tick。击杀和离场模式策略已归modes，结算提交归settlement；房间创建/加入已落实，详见engineering-room-admission.md；后续以玩家构造/CPU管理完整业务切片继续整理，不将World行数或当前重建政策通过当作E-02全部完成。
