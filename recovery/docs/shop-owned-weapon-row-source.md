# 商城已拥有武器行

UI53 / M5-10。原工厂4a1003复用ConvenientPage/lstMyItem，名单保存在owner+40。4a1104/4a1108以unsigned MyItem+0x10大于零作为绘制条件；4a112c与4a1132接收kind3或4，即炮弹与陷阱。

名称4d8366、类型4d83b3、原数量4d5f95及第四文字4d95eb依次传入4a11b7的4b9251，4a1195的owned参数为1，再沿4a11d6插入owner+40。同一原构造器的161×56尺寸、图标与文字位置复用已确认来源，不另建相同几何组件。

[原调用链](../output/shop-owned-weapon-row-source.json)保存本分支完整指令。[精确接线提案](../output/shop-owned-weapon-row-consumer.patch)只将现共享owned行扩至Inventory类别2，并过滤零数量绘制行。原Inventory记录、槽provider、分类原计数、选择与所有事务保持。

首次实际可复用已验HomeWeapon的合法保存陷阱checkpoint，正常商城进入拥有武器，检查新行名称、图标、陷阱标签及独立原数量，选择后返回与Close。无需购买；原ownedItem与右商品已验范围直接复用。第四文字、完整原事务权威和字体/native精度保持缺口。正式两处接线已完成，Web类型检查81881 exit0。[有限实际验收](../output/shop-owned-weapon-row-accepted.json)保存三张完整800/1920/3840图：原陷阱图标、名称、标签与独立数量显示，选择、Item radio返回和strictShopClose通过，运行资源与3559/5589/9789已亲清。
