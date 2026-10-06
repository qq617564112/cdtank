# PetShop 拥有行第三文字来源

UI56/M5-10。原拥有工厂4b1a36已确认第三getter4d9657；wrapper从拥有记录+8取得Pet定义，通过413c83/411068查同PetTable后调用4d8e82。loader43a91c的column5 PetMoney在43a990写record+50。4d8ead..4d8eb8执行cdq/sub/sar，按signed32除2向零截断，随后57dccf做十进制整数转换。原gamestring81为出售价，721为金钱。

pet-shop-owned-price-native.json保存wrapper、具名loader与formatter指令，并执行10条真实Pet表的column5单字段复制与signed half。复用已资格full32column loader，不重完整loader。数字转换后124条指令归一化后与已确认Item出售价4d85e8尾部完全相同，静态同串合同为出售价、双空格、金钱、signed half十进制；CEGUI最终拼接/绘制未执行。

正式显示需root将完整10项CombatCatalog.petTypes可选petMoney从原PetMoney导出。UI未来只透传同selected owned+8对应的petMoney到既有PetShopRowContent，在原third位置消费；缺值空白，商品tokenPrice分支保持。不得使用仅8sale PetShop QUERY作为完整拥有定义provider，也不能借当前购买币值计算出售文字。

文件归属提案为pet-shop-row-display.ts、pet-shop-row-content.tsx、role-shop-source-list.tsx仅Pet透传、pet-shop.tsx仅owned映射。不新API，不改SELLdisabled或购买/拥有账户事务。四file exact consumer patch已prepare于pet-shop-owned-price-consumer.patch，状态索引pet-shop-owned-price-preparation.json。等待root完整10项petMoney metadata与共享窗口，未apply/type/Chrome。

后继实际仅真实保存Pet2三分辨率新第三行文字及glyph可读/不交name和kind、严格ShopClose；复用原row/icon/导航/selection证据，不重复BUY/SELL或旧名单几何。完整UI56、出售authority及原1:1保持未完成。
