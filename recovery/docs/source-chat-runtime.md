# 原战斗聊天普通输入与频道选择（M5-12-S）

正式WAITING／PLAYING／FINISHED聊天由React BattleChatView及源界面组件呈现，BattleChat持有确认消息、房间会话及请求门禁。Battle消费当前快照身份与局号，普通输入、IME、快捷输入、pending、失败保稿和离房／断线清理沿现有消费者执行。

源战斗舞台以800×600等比居中，game_main_chat_shrinked根位于y435。原图、矩形、普通／密语输入、光标、频道菜单、表情菜单与历史滚动消费者均已接；源聊天在资源未就绪时使用现有fallback。源菜单仍按Web锚定方式定位，原弹出位置与完整CEGUI文字排版来源范围保持开放。

普通频道当前为公共0、队伍1、密语2、好友3、GM4、Family5。密语对象名单来自权威RoomSnapshot，好友走FriendChat，Family走确认归属与FamilyChat，GM问题与人工回复沿现支持链路。六频道已有正式请求消费者，Family三页及GM回复新增范围仍待实测；公共／队伍／密语／好友的已有有限证据沿各专题复用。

原Public/Team选择合同见chat-channel-selection-source.md，服务端路由与权限采用规则见[room-chat-runtime.md](room-chat-runtime.md)、[team-chat-runtime.md](team-chat-runtime.md)、[friend-chat-runtime.md](friend-chat-runtime.md)、[family-chat-runtime.md](family-chat-runtime.md)和[gm-support-replies-runtime.md](gm-support-replies-runtime.md)。React归属与已有迁移证据见react-battle-chat.md。

原Windows线上协议、Family／GM服务端来源、完整文本标签／排版、完整页面及高清性能保持各自父项；已接频道、表情与滚动状态不关闭UI-11／M5-12／M6-08完整验收。
