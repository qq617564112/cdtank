# kind4 部件整实例出售合同

M6-06。原495e90的kind4分派494927，非零实例是唯一出售输入；发送3f8a（32位instanceId），不携数量、期限、客户端报价或装备槽。构造492e5f/vtable5cb28c，getter4922cf确认消息身份，writer42571f/reader425ba6复用已恢复单实例codec。

494927通过Inventory43bddc virtual+3c取得同Itemrecord，读取+c定义用于4396e0分类，再将同指针交439947读取+ec ItemMoney。客户端准入是inventory分类3/4/5（10001..12000、12001..13000、13001..18000），模式2及存在profile/Itemprovider。售价严格为uint32(ItemMoney)右移1，14003 money2000对应1000；没有期限乘数，不从分钟解释件数，也不同于Pet/Tank signedhalf。原Item loader列20→+ec资格复用已有Itemloader和维修合同。

发送前读取profile selector26，加售价按uint32回绕，再与999999999无符号比较。超过时owner+5c反馈result0；其余本地缺条件直接返回false。完整494927不读Break、MyItem state2或资料装备槽，没有客户端“已装备禁售”资格。

回执3f8b/vtable5cb9b8，通过498748/498790顺序传instance32、result8、fullMoney32。注册496ef3→491b90将495463绑定至接收树。**成功result1**，与Pet/Tank result2分开。receiver先完整替换profile money selector26，再通过43bddc(instance)→Itemrecord+c→4396e0→43d583(instance,1,category)删除；其他result不改余额/库存，只向owner+5c virtual+8回调。

分类3/4/5分别进入43cff8/43d041/43d08a，扫描vector+2c/+3c/+5c内record+4实例；匹配后调用删除析构并vectorerase4f14f5。三个分支不读record+10，不扣分钟或数量。MyItem构造43bcb5设置vtable5c4d10，其首项43bd1d只恢复虚表及条件operator delete57a6c7，不写profile或快捷槽。

[源脚本](../evidence/durable-item-sale-contract-source.py) 与 [指令合同](../output/durable-item-sale-contract-source.json) 保存具体字节、虚表和断言；只核这一新kind4链，不执行Pet/Tank旧sender或native矩阵。

## 服务端边界

原server授权、实际发奖、原子结算与持久不可由客户端合同恢复。采用该报价结算及成功清本账户已确认profile引用（+118、+13c三槽、+148五槽）与hotkeys属于明确Web重建；原receiver仅删除实例，不提供自动卸下或完整资料清理。selected tank/pet不因本部件出售而改变。此链不引入Break或装备状态拒绝，不扩kind3数量出售和其它商品。UI各错误文本除发送端moneycap result0外尚无本次资格。
