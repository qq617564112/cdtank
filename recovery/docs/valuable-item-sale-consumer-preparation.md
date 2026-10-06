# 贵重物品数量出售消费者准备

原495e90 kind5分派494bad，输入实例与数量。它只处理inventory分类6，区别于已完成的Item/Weapon kind3与部件kind4。4a0ac3确认输入为正整数，category6分支发送kind5；alternate49f4d0传数量0，由非数量定义分支强制1。4396c2直接判断定义ID是否不超过4000或位于20001..21000，并非Break字段。

现正式 HomeInventory 的贵重页有完整确认 Inventory、原名字、图标和数量消费者。现目录
category6 仅鱼骨 `20001`、骨头 `20002`，价格均 `0`。当前 normal activation 已接同一
Home 贵重页：双击或 Enter 打开原数量弹窗，确认后发送 `ValuableItemSale` `SELL`，以
同实例/数量 requestId、确认 `result2` 回执和返回的完整 inventory/money/profile 更新
页面。该 API 独立于已完成的 `StackItemSale`，不把 kind3 协议扩展到 kind5，也不生成
商品或拥有记录。

当前消费链在 `QUERY` 后只允许返回 quote 中 exact `20001/20002` 且 `canSell` 的实例；
数量限 `1..min(ownedQuantity,0xffffff)`，单价为 `0`。部分出售保留实例并更新服务端数量，
完全出售移除页面行与快捷槽引用；失败走现反馈且不乐观扣量或改钱包。绑定后的
`battleQuantity` 按当前 adopted consumable policy 使用真实剩余 owned，未绑定为 `0`。

[具名来源](../output/valuable-item-sale-consumer-source.json)保存同实例查询、数量谓词和
派发分支；原 kind5 来源事实保持原样。
