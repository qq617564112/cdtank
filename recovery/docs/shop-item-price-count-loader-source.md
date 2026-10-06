# Shop Item价格分支与供给字段来源

原Item表loader `0x439b55`直接确认以下字段。`shop-item-price-count-loader-native.py`执行其`0x439c5c`至`0x439ca8`原指令，只在`0x4391c4`表值getter边界供应原`item.dat`解析列；八组实际`GGet/Durable`取值的四项存储均一致。证据为`recovery/output/shop-item-price-count-loader-native.json`，不改商城目录、网络协议或支付政策。

| 原列索引 | schema | record字段 | 写入指令 |
| --- | --- | --- | --- |
| 20 | ItemMoney | +ec | 439c6c |
| 21 | ItemCoin | +f0 | 439c7e |
| 22 | GGet | +f4 | 439c90 |
| 23 | Durable | +f8 | 439ca2 |

`EDI`由此前三轮四列循环从8推进到20，本片执行顺序为20、21、22、23；四次均使用整数mode0并直接复制返回值。字段身份来自loader写入，不由CSV相邻位置推定。

UI原getter `4d96ba`在`4d96ed`置`EBX=1`，`4d9731`读`+f4`，因此money分支值为1，coin分支值为2。此处复用UI线的精确getter来源；本片新增验收仅覆盖loader字段身份，不验字符串绘制或构造新的商品选择政策。现原表`GGet`实际值为0或2，0的含义不以money替代。

供给getter `439950`先调用`4396c2`。其资格为unsigned ItemTableID≤4000或20001～21000；资格成立且`+f8`非零时返回该值，其余返回1。因此不能把全部商品的`Durable`直接发布为供给数量，例如17061虽表值3，但不满足该getter范围。原字段名也不证明服务器按该数量创建库存、按批支付或实施耐久生命周期。

本片为原客户端表到商城reader的来源闭环；原服务端购买授权、成功回包与库存producer仍是独立缺口。
