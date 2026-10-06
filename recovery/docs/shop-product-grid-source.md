# 商城商品双列区域

UI53 / M5-10。原ConvenientPage加载shop_itempage.xml，lstShopItem在owner+44。49eaf5与49eb37分别调用原导入MultiColumnList::insertColumn，列0与列1宽度都读取5cc120的171。4a08f9建立新行第一列，4a0905通过MultiColumnList::setItem填第二列；4a090e按(column+1)%2推进。因此原商品名单为两列、按行排列，商品按每行两项排列。

[原指令证据](../output/shop-product-grid-source.json)保存初始化、导入函数身份、列宽与商品放置调用。普通商品ID<=4000经4396c2选择4b9251行，owned参数为false。尺寸getter沿4b923b，绘制原点横移10，图标(14,8)，名称(53,4)，类型(53,18)。选中区域从10起宽161，完整列171；右名单不能继续沿用网页42px单列或左拥有行的原点。

商品名称仍为4d7e58的ItemName输出，类型4d8429为原gamestring685+kind。数量439950读取原record+f8，非零则直接返回，否则返回1；它不是当前拥有Inventory数量。价格4d96ba按原record+f4分支（1金钱、2星币）读取record+ec或record+f0，并组合“购买价”“金钱”或“星币”。当前Shop QUERY只提供两个价格，没有已确认的原分支或数量字段身份。

下一接线边界为右商品主要区域双列布局及源行内容；当前购买、QUERY、右选中状态、方向/HomeEnd操作、左名单与框下事务保持。原record+f8和+f4的现字段映射未证，不能借库存数量或账户字段。正式右商品名单现接入两列171×56行与共享4b9251组件，owned DOM与几何保持。

共享实现准备采用既有4b9251行组件，owned原点1与product原点10作为两种原构造参数，保留owned DOM及实际证据。当前QUERY的两币价格继续作为第三行secondary Web文字，data-price-provider标记shop-query-both-prices，不能称原4d96ba价格分支恢复；原商品数量留空。定向driver已nodecheck通过，尚未启动。

[正式区域验收](../output/shop-product-grid-accepted.json)保存当前QUERY十二商品/六行两列以及三res顶部与End末行六完整图。源行名称、图标、类型、当前两币secondary价格可辨；末3005普通End选中后位于实际名单clip内，Home回首后1/2名称与介绍同步，strictShopClose恢复大厅入口焦点。现名单既有首行inset4保持，行pitch按首行相对位置56确认。原提供数量保持空白，无BUY/库存/槽/房间写入。最终Webtype52830 exit0；运行与临时目录全清，3555/5585/9785空。完整商城、原价格/数量producer和字体精度仍未验收。

类别工厂原调用分别保留：4a04ad要求439762返回1，4a0500/4a0588提供名称及4b9251；4a0631允许3或4，4a0689/4a0713提供名称及同4b9251。4a07ab是原Inventory类别6贵重品分支，不能替代前两工厂的类别依据。当前formal分类保持原有业务，rdo回调与这些工厂的对应仍需独立来源核对。

原radio真实handler4a03c7已确认：event+8为Window，+38c须selected；Item控件49ec25保存owner54，4a0466匹配后进入kind1工厂。Weapon控件49ec5d保存owner58，4a05eb匹配后进入kind3/4工厂。现正式type3-only Weapon映射尚与此原consumer不同，前述十二商品actual仅证明当前正式目录双列展示。下一sourceShopItemCategory独立准备使用Itemkind1/Weaponkind3或4，不修改协议或购买权威；先协调本批发行窗口后接线与新分类导航验收。
