# 原房卡购物入口（M5-02-C-SHOPENTRY）

RoomCards正式显示原roomlist.xml的btnShopping，源相对all为(85,276)–(174,315)，89×39。既有pagination容器top−84抵消sourceProps累加all.top84，复用SourceButton与room-source-page-button，未改CSS或共享消费者。原WindowsLook/Button，StateColorBlend=False、UseStandardImagery=False；Normal guangjiegouwuanniu2.tga、Hover guangjiegouwuanniu1.tga、Pushed guangjiegouwuanniu3.tga，无DisabledImage。

room-card-shop-entry-native.py执行原WLButton四完整draw入口，四state×alpha1/.5共8向量，N/H/P原图与四角alpha正确、Disabled零draw；captured-state复用room-card-button-native.json。

RoomCards新增openShop()父接口，源按钮disabled=busy；RoomControls仅透传既有openShop。父App记录实际入口按钮，打开已有AccountShopView；目录保持下层，关闭时返回仍连接且可用的源入口，左侧商城入口也保持。商城沿既有账户Shop QUERY显示商品与余额，不新增网络或购买事务。原有refreshing合并busy使刷新pending期间入口禁用。

## 边界

原完整Shopping callback未恢复。源资源/矩形/draw/capture有原消费者依据，按钮打开React商城与返回焦点为明确Web入口投影。现商城不是原完整shop.xml恢复，原大厅完整窗口/GPU和原商城业务界面仍留父项。本片只查询，不触购买或账户保存变更。
