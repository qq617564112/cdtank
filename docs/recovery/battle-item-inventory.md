# 正式战斗快捷栏库存接线

M5-04 / UI-09。BattleItemInventory 读取现 Inventory API 的角色快捷槽与真实本局库存，供原八槽 HUD 消费。进入 PLAYING 时以房间、轮次和本人为上下文查询一次；本人成功 itemUsed 或 ammoConsumed 后重新查询。拒绝、远端事件和普通快照 tick 不产生读取，也不在客户端扣除库存。

同一时间只保留一个读取；读取期间出现后续消费时，其旧响应不发布，随后查询确认的新状态。WAITING、退出、换房、换轮次和场景销毁清空旧数据；晚到的响应不能带入新上下文。读取失败显示未知，后续成功消费或新入场才重新读取。

数量为服务端 Inventory.battleQuantity 的 Web 确认投影，原数量 setter、默认炮弹数量、冷却及选中状态仍未恢复。图标与键位布局由 hud-item-source-page 的原来源与 consumer 提供，账户消费、保存和技能作用沿既有正式服务端流程。

`tests/battle-item-inventory.cts` 验证成功消费刷新、拒绝与远端事件不刷新、连续消费串行读取、跨房/跨轮次晚响应隔离、失败无伪库存及 WAITING 清空。模块日志为 `recovery/output/battle-item-inventory-module.log`；实际页面验收见 `hud-item-source-page-accepted.json`。
