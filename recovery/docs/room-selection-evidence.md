# 原房间创建与模式地图选择证据

源目录：`recovery/output/verified/assets/data/Data/ui/layouts/`。以下从原XML解析，不代表按钮对应的服务器业务已恢复。

## 创建房间

`createroom.xml`包含：`edtRoomName`、`edtPassword`、`rdoCatVsDog`、`rdoNonCatVsDog`、`btnDecLowBound`/`btnIncLowBound`、`btnDecHighBound`/`btnIncHighBound`、`rdoFriendlyFireOff`/`rdoFriendlyFireOn`、`btnOK`、`btnCancel`、`btnClose`。

房名原矩形为(102,38)–(222,54)，密码为(102,69)–(238,85)，均相对父节点。两组等级边界按钮、种族对战和友伤选项存在于原界面；默认值、校验范围和服务器应用尚未从执行链确认。不能把当前Web建房的房名/模式/地图三项覆盖称为完整原创建房间功能。

## 模式与地图

`selectgamemode.xml`原模式控件分别为`rdoTeamMode`、`rdoConquerMode`、`rdoVIPMode`、`rdoMeleeMode`、`rdoDestroyMode`。`rdoTeamMode`原XML有`Selected=True`，其余未声明同属性。地图展示槽为`picMap0`–`picMap7`，翻页按钮`btnPageUp`/`btnPageDown`，页码`txtPage`；页大小为八个静态槽，但在线填充/排序/分页算法还待原程序链确认。

`selectgamemode_icon.xml`内地图卡片为158×168，含`picMapImage`、`txtMapName`、`picRecommended`、`picActivity`、`picNew`、`picFestival`。默认推荐/活动状态、缩略图映射仍未确认。

`room_main.xml`有`edtMapDesc`、`btnReady`、`btnCancel`、`btnInvite`、`btnCatTeam`、`btnDogTeam`和`btnClose`。准备按钮与取消按钮位于同一(197,335)–(353,385)矩形；按钮显示条件、房主开始和成员换队规则需进一步恢复。`room_main_dialog.xml`有`wndDialog`/`txtMessage`。

模式表来自`recovery/output/verified/tables/m001.json`至`m005.json`：团队7、占领5、擒王7、混战4、破坏3，共26个模式地图组合、13个独立地图ID。其余已恢复地图资产没有在这26条基础表中作为可选组合出现，不猜测绑定到任意模式。

## 当前重建实现

新增ListMaps目录与CreateRoom原子建房/入房API，从上述26行读取MapID/MapName/Time/PlayerMin/PlayerMax。非法组合拒绝，不回退地图。Web用重建表单选模式/地图/房名，未恢复原八槽卡片、密码/等级/种族/友伤业务、邀请、换队或原准备窗口；这些仍属于完整目标。

后续实现状态：显式准备/取消准备与猫狗换队、权威等待名单已接入重建面板。原控件存在作为UI业务依据，完整原布局与服务器换队策略仍待恢复；前述未恢复换队记录是先前状态。

后续密码房业务：当前已接edtPassword对应的设置/锁列表/入房校验，Web使用重建表单，不宣称64字范围、摘要算法或错误码与原服务器一致；原布局精确表现仍待恢复。

原roomlist_icon.xml另有picLock，原矩形(29,9)–(45,26)，Image=set:lobby_ditu20 image:data\ui\lobby\lobby_ditu2\s.tga。当前列表仅文字锁标记，未恢复原卡片图块表现。

## 聊天源控件与当前边界

原chat.xml有ChatTextBox（RichEditbox，父内矩形11,11–585,125）、picNormalChat（52,165–579,189，liaotiantiao.tga背景）、edtNormalUserInput（父内14,4–518,21）；另有picIntimateChat/edtIntimateNameInput/edtIntimateChatInput和表情展开按钮。XML只能证明这些控件存在，尚不能证明普通频道作用域、私聊协议、输入长度或发送触发条件。

当前Web采用独立重建房间聊天面板，channel=0仅发同房成员；普通/私聊/公共频道原语义与原窗口像素表现继续待恢复。不把控件名直接当作服务器规则。
