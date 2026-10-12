# 2011有限弹药消费

M2-02-AMMO11-B复用已交付2007消费合同，将正式已确认2011加入有限弹药资格。普通玩家从账户库存配置槽2、Digit2确认后，Space合法射击先提交账户CAS，再扣拥有/本局各1，发布ammoConsumed和2011发射；最后一颗保持2011，下一就绪空量请求拒绝且切默认2001，无shot/reload写入。默认弹不消费；保存false/throw保留确认与数量，拒绝本次输入。

原服务端耗量producer未恢复，此数量策略为重建规则；不推2011原伤害、弹速或轨迹。原053/GA08消费者与来源复用combat-muzzle-2011.md，数量协议和React语义投影复用ammo-stock-runtime.md。持久消费只扣owned，保留原battleQuantity字段，Ready按剩余owned初始化本局量，再战不补。

生产改动限定battle/items/ammo-consumption.ts既有资格，接口/schema/数量消费者无需重写。tests/ammo11-consumption-world.cts实际World/SQLite验证CAS先提交、保存false/throw、两颗与耗尽默认、持久其他字段保留、账户隔离及无账户有限内存，已PASS。真实网络/双网页及重启验收由ammo11-consumption-network-browser.md记录，不以该规则专项代替。

实际业务完整接受：network09-42-07完整覆盖双房CAS/两局/消费账户重启，正式双网页business10-06-46完整覆盖同账户库存配置、普通两颗消耗/耗尽默认、两局再战/离场及实际服务器重启UI库存与槽。绘声单独引用09-43/45有效特殊弹表现及10-03短诊断双端默认004五图元/GA07输出，原FAIL保留，不声称单run全visual。原动作时钟符合已恢复合同，不据旧缺失记录造queue或替代炮口。完整接受范围见ammo11-consumption-accepted.json及ammo11-consumption-network-browser.md。工程证据两端构建/359边界复用原通过记录。
