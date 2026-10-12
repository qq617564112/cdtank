# 消耗品与弹药数量出售

M6-06 正式 StackItemSale 接受 QUERY 或 SELL(instanceId, quantity, requestId)，返回完整 inventory/profile/money 和 result2 的成交数量与金额。原 kind3 合同见 stack-item-sale-contract-source.json。

原子账户事务在分类1/2拥有量内按 unsigned(ItemMoney) 半价结算。部分出售保存同实例其他字段并投影 battleQuantity=min(剩余拥有量, BattleUseMax)；全部出售删除实例并清其快捷引用。profile 仅更新金钱，不清部件或外观实例字段。同请求重放不重复结算，不同实例或数量拒绝；无已建立 profile 时 QUERY 不创建资料。

正数量、数学金额上限、账户归属和持久事务、WAITING 权限与清全体重复快捷引用为 Web 重建。原成功分支只清首个快捷匹配，当前正式配置允许同实例多槽，因此完整删除清全部引用。原数量线单位为件，耐久部件分钟不进入此事务。

专项事务验证覆盖部分和全部出售的回执失败回滚、快捷引用保留/清除、战斗数量重算、其他字段与账户保持以及重开恢复。独立协议和服务端发行已通过，实际 session/exit 和后续页面/网络证据以 stack-item-sale-engineering.json 与根审为准。
