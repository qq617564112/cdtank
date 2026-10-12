# M2-02 无拥有来源CPU特殊弹实际链

正常空Account建房/加入、正式CPU ADD/CONFIGURE临时2007库存1、正常Ready后，CPU自主选择特殊弹、实际发射及消费到0；原末发装填6.900000095367432秒到期后，耗尽资格拒绝并退回普通2001；下一次自主输入实际发射并将普通弹量6→5，间隔为原1.7000000476837158秒。两个普通账户库存始终为空，CPU临时配置没有创建账户库存或拥有记录。

实际证据tank-ammo-cpu-special-network-2026-10-04T16-04-57-629Z.json/.log，状态PASS_CPU_TEMPORARY_STOCK_SCOPE；144共同room/tick/phase的完整players一致，正常双端Leave及服务/临时数据库清理通过。

| 状态 | 模拟tick | serverTime毫秒 | 接收wallTime毫秒 | 弹量/原装填 |
| --- | --- | --- | --- | --- |
| CPU特殊发射 | 5 | 1791129899416 | 1791129899420 | 2007，0/4，末发6.900000095367432秒 |
| 耗尽拒绝/退回 | 143 | 1791129906343 | 1791129906344 | 2001，6/6，上一装填deadline已到 |
| 下一普通发射 | 144 | 1791129906392 | 1791129906395 | 2001，5/6，普通1.7000000476837158秒 |

原来源：tank1 TankDelay0/TankBullet0；实际2007/4005技能经原selector/432951累加及限幅/转换得到容量4、普通2.299999952316284、末发6.900000095367432；退回时重新安装2001/4020并走同一计算。skill安装、特殊库存数量、CPU临时配置/自主选弹、耗尽拒绝与返回均为明确重建producer，不能算原服务端规则恢复。数字合成直接来源及原执行覆盖见tank-ammo-qualification.md。

本次切special前普通弹匣为满6，返回6仅证明保存该状态；未验部分普通弹匣是否保持，不冒称完整“切回不赠满”。部分弹匣正式fixture证据继续复用，但不是新账户普通取得路径。合法新账户购买special及选择tank1/pet1、独立boundGear/驾驶10151仍未完成；全配装与21车运动父项不勾。

Runner tests/tank-ammo-cpu-special-network.cts仅正常API和自主CPU输入，无AccountStore写入或活跃位置/HP/伤害/事件/胜负注入。命令`npx tsx tests/tank-ammo-cpu-special-network.cts`；独立严格类型日志tank-ammo-cpu-special-network-types.log通过。此验收是独立弹药资格改变后无拥有来源CPU special的首次必要检查，没有重跑旧native/全部车型/五模式或保存重启。

M2-02原位更新建议：引用本证据登记空owned CPU正常临时库存配置→自主有限消费→耗尽退回→computed普通消费→双端及账户隔离实际范围，保留玩家合法special取得和部分普通弹匣切回条件，不新增成果包装编号。
