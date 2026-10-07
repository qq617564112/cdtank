# 部件商城已拥有名单原行

UI55 / M5-10。交付原shop_partpage.xml的已拥有Common主要名单。原加载513732，ShopEquipPage/lstMyEquip保存controller+48；product列表+4c分别保留。owned factory515410/51550f通过43bd09→4396e0对MyItem+c分类，kind5实际13001..18000，取instance+4经4ba7df owned=true构造并加入同+48。

名称4d8366以MyItem表ID+c→global+120/43bda2→4d7e58，输出同原ItemName；constructor以实例ID经43d753查ItemTable ID，再413c74/411068读取IconID+4c，格式daoju0/data\ui\daoju\%05d.tga。正式Inventory.instanceId/itemTableId及CombatCatalog同ID的name/iconId已由主线确认来源。

vtable5ceef8的getSize4b923b为161×56，draw4bac37选中底161×51；icon4,8，name43,4，secondary43,18、tertiary103,18、fourth43,32。原位置不同于Item5/44，不复用其几何。本行名称与图标范围已有限接受；额外图标仍为空。第二、三、四文字由后续独立来源合同接入。

当前状态：原 `4ba7df` 拥有行的当前角色已装备状态已接线——`PartShopRowContent` 在 `installed === true && !product` 时用现 `SourceFeedbackText.colour` 把该行四段文本整体切 `#808080`（无 `E`、不灰 icon、不灰整行、selection 不变），`installed` 由现 `partSale({operation:'QUERY'})` 的 `sale.profile` 按当前角色安装等式派生；商城 Hat 保持 `classifyItemId === 5`，不把气球/标志外推，无额外 fallback QUERY。本轮新灰字无实测；详 M5-10-PART-STATUS、shop-mend-owned-equipment-status-presentation.md。

owned四文件part-shop-owned-row-content.tsx/CSS、part-shop-source-list.tsx仅原kind5分支、part-shop.tsx exactitemTableId透传。产品与Hat/Mark分支、QUERY、选择及交易保持。统一57715 finaltype/build/copy均0。三分辨率实际证据与主审见part-shop-owned-common-row-accepted.json及part-shop-owned-common-row-root-review.json。真实记录instance3/14003/qty1，三图名称、图标、选择与Close通过。

3574/5604/9804独立runner使用09-57合法保存账户副本已购14003，不购买、不写records/funds。正常Shop→Part→选真实instance，800/1920/3840仅新行name/icon/161×56、源4/43位置、选择焦点与strictClose。每图与metrics先存，失败也保存checkpoint。旧滚动、购买与装备证据复用，不关闭全PartShop或原交易authority父项。
