# 原房卡“我的家”入口（M5-02-C-HOMEENTRY）

RoomCards正式显示原roomlist.xml的btnMyHome，源相对all为(4,276)–(85,314)，81×38。既有pagination容器top−84抵消sourceProps累加all.top84；复用SourceButton与room-source-page-button，无CSS或共享消费者改动。原WindowsLook/Button，StateColorBlend=False/UseStandardImagery=False，Normal myhomeanniu.tga、Hover myhomeanniu1.tga、Pushed myhomeanniu3.tga，无DisabledImage；原图片中文字为“玩家信息”，当前“我的家”标签与库存入口是明确Web投影。

room-card-home-entry-native.py执行原WLButton四完整draw入口，四state×alpha1/.5共8向量，N/H/P原图片及四角alpha正确，Disabled零draw；原captured-state复用room-card-button-native.json。

RoomCards新增openInventory()父接口，源按钮disabled=busy，普通点击调用接口。RoomControls仅将既有openInventory接入RoomCards；父App记录实际普通入口按钮，打开既有HomeInventoryView。目录保留为下层模态；库存关闭后返回仍连接且可用的原入口，既有左侧入口行为也保持。真实账户Inventory查询与原有库存界面会话沿既有逻辑，不新增网络或物品操作。

## 边界

原完整MyHome回调未恢复，当前从原按钮打开React库存页为明确Web入口投影。原按钮图/位置/状态有源消费者依据，现库存页不宣称原完整MyHome窗口等价；全窗口锚点、原完整GPU画面及其余家园业务留父项。本片由主agent独占App入口焦点接线；专线只修改源按钮与RoomControls prop，不修改目录规则、协议、网络、场景或保存机制。
