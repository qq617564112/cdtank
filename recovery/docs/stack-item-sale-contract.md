# kind3 消耗品与弹药数量出售合同

M6-06 / M2-02库存生命周期。原495e90 kind3分派4945f7，输入实例和数量，限inventory分类1/2（定义1..1000、2001..4000）。这条链对应正式Shop拥有Item/Weapon的数量库存，不将kind4耐久部件分钟混入件数。

发送3f86：instanceId32、quantity24。结构内+10是DWORD，但codec492d6b/492d9f只编码24位数量；没有客户端报价。sender模式2、本机profile与Itemprovider存在，再用43ccac/43cccf查同实例的原MyItem+10，按无符号要求requestedquantity不超过拥有量。没有数量0或已配置hotkey禁止；超量反馈result0。单价439947为uint32(ItemMoney)右移1，乘quantity按低32位imul，金钱加总也按uint32，再与999999999比较；超限反馈result1。

回执3f87：instanceId32、quantity24、result8、fullMoney32，依次对应+c/+10/+14/+18。496e5d注册495346，仅success2完整写profile money selector26；随后43d186(instance)→43bd09分类→43d583(instance,replyquantity,category)，回执实际quantity控制减量，其他result不写余额或库存，只向owner+54回调。

category1进入43ce40，category2进入43cf1c。若ownedquantity大于replyquantity，owned+10减量，Item定义存在时battle+20重新计算为min(newowned,Itemrecord+104 BattleUseMax)，其他MyItem字段保持。定义缺失时仍减owned，但battlequantity不写。若ownedquantity不大于回执量，则profile selector0七hotkeys清首个匹配实例，再释放并erase完整MyItem。原virtual+20经42fe3f→4208b7 selector0返回dataobject+100，不能把原对象地址偷换为profilepayload+11c；正式hotkeys独立表为Web映射。原该分支实际清快捷槽，区别于kind4整部件删除只删record的合同；这里不清profile部件实例槽。

[源脚本](/workspace/cdtank/recovery/evidence/stack-item-sale-contract-source.py) 与 [指令合同](/workspace/cdtank/recovery/output/stack-item-sale-contract-source.json) 保存codec、writer、减量和whole删除字节。unsigned半价、MyItem析构及selector0字段复用既有来源，不执行旧购买、维修、PartSale或Pet/Tank源矩阵。

## 正式接口边界

最小新业务输入是SELL instanceId/quantity/requestId，成功包含instanceId、acceptedquantity、result2、完整money/profile/inventory；QUERY可提供拥有实例/数量/单价。服务端须核当前账户实例、分类1/2、原始已知单价和可卖拥有量，事务同时记录减量与余额，重复请求不再售出。

原server授权、回执quantity选定和原子持久仍未恢复；正数量门禁、数学金额上限而不沿客户端低32回绕，以及WAITING/PLAYING权限需明确Web重建。原成功部分出售会重投影本局数量，完全出售会移除实例并清快捷引用；不得把它只实现为报价或显示而遗漏实际库存与技能来源撤回。原所有UI数量框/确认与错误文本未由本合同恢复。
