# 战车改造费用与确认字段

M6-03。[具名来源](/workspace/cdtank/recovery/output/tank-upgrade-contract-source.json)串联原49393e、TankUp manager413cef、record loader43b911与3f94/3f95。原表一条rank3通过完整loader实际执行，字段对应等級、花費金錢、花費創意點數、失敗率、成功率，值为3/5/30/10/89，见[tank-upgrade-cost-loader-native.json](/workspace/cdtank/recovery/output/tank-upgrade-cost-loader-native.json)。

action1火力使用owned+38资格和+44等级；action2装甲使用+48资格和+54等级。下一等级查询TankUp，费用为原TankMoney乘表Money比例后的32位低乘积，再无符号整除100；創意點數直接读取表+14。请求仅action8、owned instance32。等级255、缺下一行、余额不足及未启用分别进入具名客户端门禁；这些不是服务器授权实现。

原3f95完整回包为action8、instance32、money32、originality16、attribute16、bonus16、result8。495970在profile与owned实例存在时先替换完整余额，再处理结果。result0对应等级加1，result2对应等级减1；两者都复制服务器返回属性与加成，分别写攻击+3c/+40或装甲+4c/+50。其他结果保留等级与属性。

尚缺原服务器结果抽样、返回属性/加成计算，以及owned+38/+48启用producer。表rank3失败10与成功89不支持推定概率区间或归一化；现正常新购实例两启用字段为0，不能直接打开升级资格。本片为source准备，没有正式改造事务或玩家实际验收。
