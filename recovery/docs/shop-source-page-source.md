# 正式商城根页（M5-10 / UI-51 / UI-53）

正式AccountShopView采用shop.xml原625×393根，右图框底边404决定页面内容625×404。anniuditu(1,0)-(209,43)、zkb(0,35)-(216,403)、hongsexiaodi(209,0)-(606,45)和youbiandaditu(209,34)-(614,404)通过SourceStaticImage消费原蓝顶条与两分栏九块图框；btnClose累加quxiaoditu后位于(570,-2)-(607,35)。五原分类按钮使用SourceButton，当前账户接口提供道具目录，其他分类保留原图并以aria-disabled与非焦点状态限制操作。

shop_itempage.xml根偏移(0,36)，右youbanbufen为(210,0)，lstShopItem相对(12,61)-(388,340)，所以实际商品列表全局(222,97)-(598,376)。正式原位置显示服务器QUERY确认的全部可购买商品，普通鼠标/方向键选择驱动同一selected状态；商品原名、说明、独立金币/软星币价格与daoju0源图使用权威目录。当前武器与贵重品子分类未接获取业务，保持不可操作；不填未实现商品。

原左余额区jinqiandaibilan位于(0,331)，消费底图、金币/软星币图标与txtMoney/txtCoin确认数值。原lstMyItem属于拥有物品列表，当前Shop响应不含完整库存，未用选中商品冒充拥有列表。左栏现选中商品详情、数量、货币与购买/刷新为Web事务映射；现页不虚构库存、维修、战车/宠物/部件获取权限。

AccountShop purchase owner跨页面保持requestId，busy门禁、确认更新、拒绝草稿、关闭后的晚响应隔离与重新打开重试沿已完成React购买事务。生产只改变页面布局与资源消费、加载原字体及viewport缩放，不改Shop API或服务端账户事务。data-shop-item/product/quantity/currency/buy/refresh/status/close/balance及data-purchased-instance保留。源Close与Escape回正式大厅源入口焦点。

## 限制

已取得源商城根、商品列表与余额资源；shop.xml/shop_itempage.xml未提供当前BUY、数量和支付确认入口，其原回调/服务器资格来源仍缺，保留Web操作映射。当前统一比例缩放、浏览器列表文字与键盘、左详情与状态位置不是原renderer像素等价。原拥有物品、全部分类与维修、原详情弹窗和全204商品仍属于未完成M5-10/UI-51/UI-52/UI-53及M6-06。
