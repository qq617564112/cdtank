# 商城原已拥有行第四文字

UI53 / M5-10。4d95eb读取MyItem+0xc的ItemID，以413c74的同Item表和411068查找原记录，直接将4d85e8输出交还原caller。4d85e8读取原Item+0xec，unsigned右移一位后按十进制转换，原CEGUI拼接顺序为“出售价”、两个空格、“金钱”、数值。

主线已确认原loader将ItemMoney列20写入Item+0xec；现export与CombatItemDefinition.moneyPrice保留这个原数值。[来源合同](../output/shop-owned-sale-display-source.json)保存完整wrapper/getter及六组真实原指令shift/push参数执行；不以此声明完整C++字符串执行。

[接线准备](../output/shop-owned-sale-display-preparation.json)只读消费现可选moneyPrice，缺值为空，真实0显示0。Item与Weapon现owned第四文字均进入共享4b9251的原sourcePrice位置；product的getMethod价格保持。新字段不引入出售事务、购买倍率或新协议。

runner采用两个已有合法保存库的临时副本，同一Chrome进程串行打开正常商城，检查Item1与Weapon3003第四文字在800/1920/3840的真实glyph、可读性与Close。原161×56名单、图标、数量及分类实际直接复用。四处共享接线已落，最终Web类型检查63362 exit0。[有限只读验收](../output/shop-owned-sale-display-accepted.json)保存一个Chrome串行两合法库副本、六张完整800/1920/3840图与两次strictShopClose。原ItemMoney10显示“出售价  金钱5”，真实glyph位于现源行内且不遮名称和类型；进程与3561/5591/9791已亲清。出售动作和权威保持未接。
