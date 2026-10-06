# 角色VIP属性来源

完整原版角色构造函数431bcf及网络角色构造函数42275e均在431c1e将role+98写为整数0。8个执行样本覆盖两种角色和四种初始内存填充值，写入监测记录到相同构造写点。

网络角色vtable5c2c28的布尔属性写入口4227f0转入432738。selector2把参数低字节写到record+50，通知record的selector11，并将role+2b4置1。对应读入口4227e6转入432196，selector2返回record+50。此链不会写role+98。

433ce1—433cf4只检查record+50是否非零；非零时用role+98与已经限幅、转换后的record+58作32位整数乘法，然后写回record+58。执行证据使用构造函数产生的真实0值：VIP标志非零时该尾段得到0，标志为0时保留原值。

运行：

```sh
recovery/.venv/bin/python recovery/evidence/attributes/role-vip-multiplier-native.py
```

结果文件：recovery/output/role-vip-multiplier-native.json。8个完整构造样本及18个真实属性写入、读取、VIP尾段样本通过。矩阵构造的CRT memcpy及record通知终点由夹具提供。

## 未恢复来源

role+98的后续非零写入来源尚未恢复。构造函数的0不能作为完整战斗准备后的VIP倍率默认值；表中的VIPHPMax也尚未与该存储字段建立原版写入链。生产属性重算仍应保留VIP来源门槛。
