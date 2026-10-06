# 拥有宠物与战车出售合同

M6-06。原 Pet btnSell 注册4b1e1d绑定4af7f9，候选行+9c保存为页面+24；确认4aee9c通过495e90(kind1)调用493e7e。原 Tank owned mode1 的确认4b42aa/4b46fe绑定4b269e，以页面+1a0和kind2调用同dispatcher→494150。分别发送3f7e/3f82，仅包含32位拥有实例ID，不包含定义ID、数量或客户端报价。

请求先核正常mode2与拥有实例。Pet profile selector28、Tank selector29与待售实例相等时拒绝并callback0。Pet实例经41e9f1的同表查询调用43a792读取PetMoney+50；Tank经421f88调用43b4bd读取TankMoney+48，两者以signed32除2向零截断，复用已核拥有行显示价格。profile selector26的完整money加报价超过999999999时callback1并不发送。

原3f7f/3f83共用498748/498790编码：instance32、result8、money32。49514f/495242仅result2时将reply money完整写入profile selector26，随后按同instance调用41f05a/422565移除并释放拥有记录，再向owner+44/+4c回调result。其他result在这些receiver不改余额或拥有记录。Pet回调4b1c95、Tank回调4b2577成功后刷新并选择拥有名单。

资料偏移复用真实wrapper证据：42fdc5/42fdea均将profile interface再加20交42029e/420551。selected Pet/Tank是raw record+84/+88、profile interface+a4/+a8、container+c4/+c8；money是raw+70、interface+90、container+b0。这三种基址不可互换，selector28/29始终是拥有实例ID。

原确认标签709/713为“你确定出售这只猫狗吗？”/“你确定出售这辆坦克吗？”。result0标签626/627为“无法出售出击中猫狗。”/“无法出售出击中坦克。”；result1标签143为“哇，大富翁！你的金钱太多，放不下了。”；result3标签706为“系统发生未知错误！”。前两种与sender具名门禁相同；result3仅证明显示文本，不确定服务器拒绝原因。原gamestring字段直接复用。

[原指令与字段索引](/workspace/cdtank/recovery/output/owned-role-sale-contract-source.json)保留四个消息vtable、两个完整sender与成功receiver。本次只捕获上述具名链与字段断言，原价格loader/native直接复用。

正式接口最小输入为kind Pet/Tank与instanceId；输出为result、完整money与该实例移除后的拥有投影。Web原子扣除拥有、支付同报价、去引用、重放及持久属于明确重建。原服务器出售授权、结算和回包生成尚无源码证据；不能把客户端费用门禁称为原服务器成交证明。
