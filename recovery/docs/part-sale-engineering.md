# 拥有部件整实例出售

M6-06 的正式 PartSale 接口接受拥有实例和请求 ID。QUERY 返回本账户 category3/4/5 的源售价、可出售资格、完整库存、资料及金钱。SELL 删除整个实例并支付 uint32(ItemMoney)右移一位的报价，成功回执 result1；剩余分钟不影响售价，也不进行数量减一。

原动作是拥有名单双击，随后显示标签711的确认框。React 名单复用这个动作，并提供 Enter 的 Web 键盘入口；商品候选目录保持购买用途。确认结果独占库存、资料和余额更新，父商城余额使用同一回执。重复请求不再次支付。

服务器核验认证、拥有实例、分类、价格、金钱上限和准备阶段。事务一起提交库存删除、余额、回执与已知资料引用清除；失败全部回滚。原发送端不禁止已装备部件，出售成功后清本账户已知装饰、标记、部件引用及快捷槽属于 Web 重建政策。选中宠物和战车以及其它资料字段保持。

成功回执在当前房间重新绑定库存和装备资料，取消本人准备并广播确认快照；重放不再次改变准备。正式代码归 accounts/part-sale、PtlPartSale、network/accounts 及 PartShop 消费者。

[原合同](/workspace/cdtank/recovery/docs/durable-item-sale-contract.md)与[页面入口](/workspace/cdtank/recovery/output/part-shop-owned-sale-entry-source.json)分别证明请求/回执和双击确认来源。[工程索引](/workspace/cdtank/recovery/output/part-sale-engineering.json)记录类型、事务、构建和有限实际范围。

事务检查覆盖已装备整实例出售、三类已知资料引用清除、其它资料/账户保留、回执写入失败完整回滚、重放及冲突、非部件分类拒绝和金钱上限。原服务端授权、支付及持久化不可由客户端合同恢复；现事务为明确重建。kind3 部分数量与kind5出售不属于本接口，完整 M6-06 保持未完成。
