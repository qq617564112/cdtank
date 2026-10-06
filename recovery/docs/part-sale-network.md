# 已装部件整实例出售网络范围

M6-06。真实14003实例4、剩余1441分钟，经普通Equipment装到PART0后，正式PartSale成功出售整个实例、回执result1/price1000，金钱68230→69230。WAITING资料槽清空、准备取消，roleSkillSources.selectedSkillIds从[2001,4020,10251,13033]变[2001,4020,10251]，当前宠物/坦克来源保持。

[专属驱动](../../tests/part-sale-network.cts) 复用已验Part维修双账户真实数据库与本地身份，通过compiled scripts/start-server.mjs运行。没有新增购买、维修、资金或拥有记录；14003取得与1441分钟来自已接受Partnetwork。首次类型10377退出0，原始出售首片92688退出1：正常装配已完成，仪器将Item技能[13033,0,0]的两个空槽纳入生效ID断言，未发SELL。首FAIL和真实装备后checkpoint保留，见 [首片有限分析](../output/part-sale-network-first-analysis.json)。

必要定向尾段46170退出0，复用首片真实库，不重复装配，仅普通auth/SelectRole、新房CreateJoin/Ready后完成尚未执行的出售。成功完整profile只改变money与已确认部件实例引用，Inventory删除精确实例；其他资料字节和字符串保持。replay不再支付，请求冲突、缺失实例、foreign absentinstance与PLAYING出售拒绝均保完整账户投影。

六个唯一共同PLAYING key完整players相等；两次正常round1 Leave，未开火。原生库1条出售回执、完整inventory/profile与最终QUERY相同；实际停服后同库重启，两个账户完整PartSale QUERY相同。finally保存172032字节真实SQLite备份和本地0600身份文件，清理完成且亲3614为空。新房不称恢复首房间。

[原始尾段](../output/part-sale-network-2026-10-05T20-17-18-596Z.json) 与 [组合有限索引](../output/part-sale-network-analysis.json) 保存明确范围。费用为原439947 unsigned ItemMoney>>>1，回执3f8b success1及分类5整实例移除来源复用 [合同](durable-item-sale-contract.md)；没有按1441分钟乘价或减去一件。

原server授权、原子扣除/支付和持久为明示Web重建；成功清qualified profile引用/hotkeys也是Web政策，原495463及43d08a只删record，不清资料。原sender没有装备禁售，因此本业务接受已装备实例。overflow与数据库回滚由主任务事务夹具覆盖，不在活跃网络注入资金。其余类别与kind3partial、原UI全页精度和全部父项不在本固定代表范围。

[独立主审](../output/part-sale-network-root-review.json) 已接受 PASS_FINITE_EQUIPPED_PART_WHOLE_SALE_SUCCESS1_READY_SOURCE_CLEAR_DUAL_STATE_LEAVE_RESTART_SCOPE：完整profile只money+1000与+148实例4→0、整个1441分钟实例移除、current16和六宠物rank保持、13033撤回、6共同完整players、原生1回执及双方完整重启QUERY均已独立核验。
