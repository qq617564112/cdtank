# 大厅与战斗好友频道状态

大厅`chat.xml/btnFriendChannel`原59×32，引用gy0/liantian_haoyou正常2/悬停1/按下3；`chat_channellist_lobby.xml/rdoFriend`原30×16，引用lobby_anniu30/haoyou正常2/悬停1/按下3/选中3。大厅频道类型friend采用源好友标签与普通edtNormalUserInput/picNormalChat，不显示密语目标输入。

战斗`game_main_chat_shrinked.xml/btnFriend`原47×25，`game_main_channellist.xml/rdoFriend`原30×16。战斗语义channel3选择源好友按钮、普通edtChat/picNormalChat；Public/Team/Private按钮隐藏。菜单Friend可选，GM仍缺业务。

源矩形/图集解析、频道菜单框和按钮图态沿既有频道消费者。本次增加两处Friend语义映射和实际显示；未改字体或父框绘制。菜单外部pointerdown/窗口blur关闭；Escape回当前源Friend按钮；选择频道后回普通聊天输入。战斗外部点击排除列表包括btnFriend，避免其点击被同一事件先关闭菜单。

## 限制

好友消息路由资格、跨大厅/房间范围和账户关系由对应业务文档界定；不能由频道图推断原服务器范围。当前UI只消费已接账户FriendChat状态/确认，不改变旧公共/队伍/密语消费者。原GM、完整原窗口/字体/GPU精度仍属父项。
