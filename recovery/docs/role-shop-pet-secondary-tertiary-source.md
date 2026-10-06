# PetShop两项原显示getter

原factory `4af876`给同一个Pet表记录调用`4d8c0b`和`4d9bc1`。字段身份复用已通过的完整`43a91c` loader十条结果，不重跑loader。新证据`role-shop-pet-secondary-tertiary-native.json`仅验证两个getter的原选择分支和送给formatter的double，供UI56/M5-10正式PetShop行显示接线。

| 显示 | 原record字段 | 原表列 | loader写入 |
| --- | --- | --- | --- |
| secondary类型 | +2c | 2 PetType | 43a95e |
| secondary大小 | +30 | 3 PetSize | 43a96e |
| tertiary星币数值 | +54 | 6 PetCoin | 43a99f |

`+30`不是getMethod，`+54`不是duration。

## Secondary

`4d8c41`先读PetSize：1取gamestring677“小型”，2取676“中型”，3取675“大型”，0取685“不明”。`4d8cfa`再读PetType：1取678“猫”，2取679“狗”，0取685“不明”。其他值不进入该项lookup，保留已构造的空local string。两个CEGUI String经`4d8db4`直接拼接，没有空格或其他分隔符。

十条实际记录的原分支选择均通过：阿呆“小型狗”，大麦“中型狗”，猎狗“中型狗”，丹尼斯“小型狗”，玛利亚“大型狗”；五只猫分别“小型猫”“中型猫”“大型猫”“中型猫”“中型猫”。额外两项仅验证0→“不明不明”和不匹配值→两项空，不作为现存商品或新增取得资格。

## Tertiary

`4d9bd4`对record+54执行signed32 `FILD`，`4d9bda`乘原double常数`5c4198=0.1`，`4d9be5`存double并传入`4b4ad2`。该入口使用`4b4774`建立ostream、清flag1且设置precision16；`4b47be`进入double插入`4b4396`，`4b4a4e`提取字符串。实际PetCoin只有0/350/400/450/500，原乘积为精确整数0/35/40/45/50，显示数字分别“0”“35”“40”“45”“50”。

随后`4d9c37`取gamestring78“购买价”，`4d9c94`取722“星币”。原CEGUI `String+const char*`与`String+String`调用组成：

```text
((购买价 + "  ") + 星币) + formatter数字
```

例如Pet2显示“购买价  星币35”。两个空格来自原常量`5c6660`。这是原显示倍率，服务器PetShop BUY仍须使用实际PetCoin350；不把显示35改作支付35，也不据此推购入授权、耐久或有效时间。

## 验收范围

`recovery/evidence/ui/role-shop-pet-secondary-tertiary-native.py`执行10条实际getter分支及数值输入、两条文字边界。表记录来源复用`role-pet-base-native.json`。gamestring lookup和C++/CEGUI字符串服务为供给边界；原字段读取、分支及x87乘积执行，precision和最终拼接由原指令及PE导入身份直接确认。完整locale formatter、原字体像素、正式网页显示及网络字段尚未由本片验收。

主线负责将PetType/PetSize/PetCoin来源送达正式PetShop，UI负责两项文字展示。本片无生产、协议、Chrome、类型或build改动；其他原弹药、伤害、绑定与OBB来源缺口保持原范围。
