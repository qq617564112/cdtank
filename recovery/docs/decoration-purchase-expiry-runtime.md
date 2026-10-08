# 新购饰品期限初始化

## 采用规则

精确 `10001..10040` 的 category5 饰品每次成功 `Shop BUY` 创建一个非堆叠维护实例，初始期限为
`3天 = 4320分钟`。该范围为 Web runtime 采用规则；原 `item.json` 的 `Durable=3` 继续作为原
literal 保留，不据此宣称原 server 初始值、起算条件或完整来源已经闭合。

这 40 个 ID 的 `BUY` 仅接受 `quantity=1`。`quantity=2..10` 在事务、扣款、实例分配和写入前
拒绝，不影响其它商品；普通部件与消耗品仍沿用现有 `1..10` 数量合同。普通 PartShop 消费者
只提交 `quantity=1`。

## 事务接线

`apps/server/src/accounts/shop.ts` 保留现有账户、requestId、catalog、正价、余额、
实例分配、receipt、spending 与回执幂等合同。饰品新实例插入 inventory 后，在同一
`BEGIN IMMEDIATE` 事务内调用既有 `anchorMaintenance(..., 'part', instanceId, 4320)` 写入
`maintenance_clock.expires_at_ms`。

新购数量为 1，inventory 与购买回执的 `ownedQuantity` 保存初始4320分钟；实际剩余分钟由
既有 `currentMaintenanceMinutes` 读取时钟后投影。重复的同一 `requestId` 仍走原有
早返回 receipt 路径，不插入实例，也不重新调用 `anchorMaintenance`，因此重放不会重新起算。

已有 owned 记录保持原样，不迁移、不回填，也不改写旧拥有记录的期限。分配器复用的旧实例 ID
继续先清理旧 part 时钟；40 个饰品随后在同一事务覆盖写新时钟。

## 既有消费者

- `AccountStore.inventory` 与PartShop使用的`AccountPartSale`查询均通过 `currentMaintenanceMinutes` 投影墙钟剩余；商城购买后、重开和出售后的刷新不返回固定初始分钟数。
- `AccountPartMaintenance` 读取当前剩余分钟，维修加上 `days*1440` 后重新
  `anchorMaintenance`，因此延长已有期限而不是重置旧拥有记录。
- `AccountTrade` 已经用 `maintenanceExpiry` 和 `currentMaintenanceMinutes` 转移剩余期限及
  到期时间，本批不改交易转移实现。

## 范围与验收边界

购买事务与商城库存查询共用已有维护时钟；钱包正价、收据幂等、实例分配、维修与出售价格、交易协议、schema和饰品世界模型保持既有合同。

静态实现已经接通；普通商城购买、真实 4320 分钟墙钟递减、重放、重启持久、维修延长和交易
转移仍需按对应验收范围实测。本文不把静态接线或已有消费者证据当作原来源还原。
