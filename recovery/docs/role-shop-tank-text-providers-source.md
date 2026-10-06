# TankShop三项原行文字来源

UI57/M5-10原factory `4b5d70`分别保留三种输入：从`413c95`查询的Tank表记录供名称与`4d87bb`；从`413d01`同ID查询的Tankshop记录供`4d899c`；列表`[edi]`原Tankshop记录供`4d99d6`。新native捕获四个实际getter调用的push参数，顺序为Tank、Tank、Tankshop、Tankshop，不把末项偷换成Tank表记录。

## 同表record与loader资格

`413d01`返回资源管理器`+98`。初始化`41c4ed`调用`41b287`，该构造写manager vtable`5c238c`，`41c4fb`保存到`+98`。`41bc20`使用原名字常量`5c24f4="tankshop"`，`41bc63`读取同一`+98`并调用`41a2ff`加载。其`411749`通过manager virtual+4创建record，再经record virtual+4加载列。

manager vtable+4为`43b33f`，factory调用`43b2c6`构造并写record vtable`5c4cd0`，该表virtual+4是`43b375`。此loader整数列循环明确col0写ID+0c，col1～3写默认纹理+10/+14/+18，col4写+1c、col5写+20、col6写+24、col7～9写+28/+2c/+30、col10写+34。原schema列5为“坦克代币价”、列10为“耐久度默认”。此次直接核完整指令链，不重执行旧Tank loader，也不把原纹理lookup供给证据当作loader证据。

## 三项显示合同

| getter | 来源字段 | 原格式 |
| --- | --- | --- |
| 4d87bb | TankType，Tank表col5→record+50（43b69a） | 1/2/3/4分别取gamestring680“轻型坦克”、681“中型坦克”、682“重型坦克”、683“突击炮” |
| 4d899c | Tankshop col10“耐久度默认”→record+34（43b41c） | gamestring624“（%d天）”，signed32整数原样交sprintf；无分钟除法或倒计时 |
| 4d99d6 | 列表Tankshop col5“坦克代币价”→record+20（43b3db） | uint32转double×0.1后进入4b4ad2；“购买价”+两个空格+“星币”+数字 |

`4d99e9`读取`+20`，signed FILD之后若高位为1，`4d99f9`加double4294967296，再乘原double0.1。这与Pet getter直接signed PetCoin路径不同。formatter precision16/default double输出及CEGUI拼接合同复用本轮Pet来源，不新跑整套formatter。

现11条Tankshop均真实“耐久度默认”3，因此天数文字均“（3天）”；不是现拥有实例剩余期限。币价实际0/250/300/350/400/500/600/700，显示0/25/30/35/40/50/60/70。型号含1～4，实际文字来自对应Tank表，不按ID分段猜。源码未匹配的TankType不写caller输出；正式缺字段应保持空，不补默认车型、天数或价格。

主线最小接口为原TankType与原Tankshop默认耐久字段，现tokenPrice若已由Tankshop“坦克代币价”产生可直接复用；不得改BUY支付为显示除10的值。没有新增过期、拥有、购买权限或第四extraicon规则。

## 验收范围

`role-shop-tank-text-providers-native.py`与同名output JSON确认factory记录参数身份、11商品的原车型branch、天数sprintf输入及币价x87转换。字符串查找、sprintf和C++formatter属于捕获边界；完整locale、字体像素及正式QUERY/网页交付由主线和UI独立验收。旧`role-tank-base-native.json`完整21Tank loader直接复用。无生产、协议、Chrome、类型、build或旧数值回归。
