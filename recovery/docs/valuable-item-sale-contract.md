# 贵重物品出售合同

M6-06。原495e90的kind5调用494bad(instance,quantity)，只接受4396e0类别6（定义20001–22000），不接受类别7。请求3f8e发送instance32/quantity24；回执3f8f收到instance32/quantity24/result8/完整money32。原codec复用数量出售既有资格，虚表分别5cb2b4/5cba08。

494bad要求模式2、资料与Itemrecord provider。4396c2对20001–21000返回true，按43cd5b取得拥有实例并检查请求量不大于MyItem+10；未取得拥有记录时该客户端检查仍会落入发送路径，不能当服务端授权。21001–22000强制请求数量1。报价为原439947无符号ItemMoney右移1后乘数量，乘法保低32位；金钱相加的uint32结果须不大于999999999。数量不足回调1，金额上限回调0。没有装备或Break禁售门禁。

495591只在result2成功时先替换资料money selector26，再调用43d583(instance,replyquantity,6)→43d122。类别6向量位于+6c，begin/end为+70/+74。20001–21000且拥有量大于回执量时只扣MyItem+10，不更新battle+20；否则释放完整实例并erase。该消费者没有资料引用或hotkeys清理。结果最终交owner+64回调，非成功结果不改金额或库存。

[最小来源索引](/workspace/cdtank/recovery/output/valuable-item-sale-contract-source.json)保存新sender/receiver及删除合同。原Item表仅20001鱼骨、20002骨头，ItemMoney/ItemCoin/GGet/Durable均0，Break2、BattleUseMax0。正式consumableShopItems与partShopItems均不供应类别6。

当前未闭合的玩家行为是正常取得后出售鱼骨或骨头：缺少已资格的原取得producer及正式取得消费者。表中描述捡拾后数量增加与恢复生命15，不足以确定掉落、角色资格、碰撞、消费与持久时序。价格0不构成免费购买政策；类别7既没有本表记录，也不能复用本sender。原服务端支付、原子出售和授权仍缺。未改正式协议、账户、库存或可购买列表，未启动网络或原native矩阵。

既有正式Skill目录中，20001/20002为Trigger1、Target1、Func20，参数分别T1/T2、X1、Y20001/Y20002；同物件第二技能30005为Trigger1、Func2、HP30。物件描述15与技能字段30不一致，不能据任一字段宣布最终治疗量，也不能把Func20的T1/T2自行命名为猫狗资格。取得闭环最小还需来源：接触请求/通知、目标与T门禁、数量持久写入身份，以及独立治疗执行。
