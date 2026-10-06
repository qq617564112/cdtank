# 权威普通输入接受

E-02将World.updateInput的接受门槛、序号水位、归一化、快捷槽分派和治疗调用收进battle/accept-input.ts。World只查找权威玩家，传当前房间阶段、生命上限策略和账户消费确认。TSRPC消息路由仍由battle/input查实际连接会话；CPU和本人托管继续通过World同一普通输入入口，不增加直接状态注入。

输入必须来自PLAYING、sequence为安全整数、autonomous与该玩家实际托管状态一致，并严格大于对应序号水位。真人/普通CPU使用inputSequence，托管使用独立autopilotInputSequence。接受后先写归一化输入，再提交对应序号；死人仍沿用既有输入记录行为，但不分派快捷槽。归一化保留移动/转向/瞄准[-1,1]范围、非有限值回退0、整数快捷槽和非有限客户端时间回退0。

快捷槽继续调用已恢复dispatchItemHotkey；弹药选择写正式战斗状态，道具/陷阱先产生itemRequest，然后由既有healing模块检查资格和持久消费，成功才更新生命/库存与skillCast事件。原请求成功生产链仍未完全恢复，模块迁移不扩大技能范围或把请求当作已施放。

## 验收

tests/item-request-world.cts验证普通快捷槽/空槽/冷却、请求不消费、首局再战数量上限、未分配库存和旧局输入拒绝。tests/account-autopilot.cts验证真人无法覆盖托管、本人AI普通输入两局自主消费3份并持久化；治疗夹具验证自然受伤、保存拒绝/异常/隔离/重复输入、CPU9次普通治疗与自然两局。五模式命中/结算冻结/再战和真实TSRPC移动/开火/旧包拒绝/断线再战通过。

正式服务端构建、全仓类型及202可达模块运行边界通过。日志engineering-input-{build,items,autopilot,match,healing,network,types,boundaries}.log。编译账户迷彩联机重启保存及CPU五模式各两局也通过，单列engineering-input-compiled.log；正常网页CPU入口资源失败重试、准备/实际渲染与CPU运动/退出回归通过，单列engineering-input-browser.log。

## 剩余边界

index聊天/断线和广播tick已归rooms/transport与runtime/tick并验收，详见engineering-room-transport.md；World仍有部分只读来源/属性投影和目标伤害写入。下一片将目标伤害计分归modes并整理只读战斗投影，审查World组装边界。E-02仍未完成；这些回归不证明原完整技能、服务端玩法或全内容高清表现。
