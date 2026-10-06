# 大厅频道菜单原共用消费者

UI-03 chat_channellist_lobby.xml六控件，UI-01只涉及已接频道与密语对象按钮。本片保留M6-08-W/F普通频道选择和现中文输入/对象业务，不重跑多端权限与好友关系事务。

原all为(6,2)–(54,158)，biaoqingfuhaokuang相对all为(0,46)–(48,156)，四radio为30×16，源父内位置y59/83/107/129。八frame与中心均原20×20、AutoScaled=true/native800。旧SourceChatFrame固定20px消费者及旧SourceButton缺capture/selected二层，需接已确认共享消费者。根位置、图、控件几何来自原XML/ui.json；菜单附着在大厅(0,454)，offset(-6,-48)仍是现Web接线，无原动态位置producer依据。

拟归属lobby-chat-channel.tsx整个菜单、lobby-chat-view.tsx仅密语对象按钮shared import、lobby-chat.css仅菜单根/frame规则；独立source/browser/doc。原六控件接SourceStaticImage/SourceButton，继承LobbySourcePage既有SourceImageScale。四频道中GM仍禁用，原DisabledImage空，不发明图或权限。选择公共/密语/好友调用原change后聚焦现唯一输入；Escape回原频道toggle，开菜单聚焦当前可用radio以便键盘。外部pointerdown/blur关闭保持。

root只提供SourceButton chat.xml/chat_channellist_lobby.xml suffix类型，不改App/网络/频道资格/发送/账户关系。验800×600/1920×1080/3840×2160大厅带完整菜单，原frame/按钮图层/文字和位置、正常频道选择/取消/中文草稿保持及键盘/capture；无BUY/建房/Ready/对局/关系写入。不以当前按钮菜单完成扩大为全chat.xml或原路由/字体/1:1已恢复。

## 实际交付

正式lobby-chat-channel.tsx六源控件已接共用StaticImage/Button，原8frame与中心图继承大厅SourceImageScale整数尺寸；toggle与密语对象expand按钮复用同状态消费者。GM DisabledImage为空保持无图、不造权限。旧固定frame绘制移除。开菜单焦点当前频道，所有菜单keydown/keyup隔离，Escape回现toggle；正常选择仍原change后focusInput，无网络/发送/权限修改。

21-02-20 raw整体FAIL，仅有效范围采用：800/1920/3840大厅带完整菜单，六controls/八frame精确资源、PNG加载与viewport、Public选中两层与GM禁用零图；Native鼠标Hover/Pushed、捕获拖外Hover+pushedtrue、outside释放Normal+pushedfalse且hasCapturefalse、保持原公共频道。Escape window keys[]严格toggle焦点。普通公共/密语/好友选择后原中文草稿“频道中文草稿”保持且input焦点，密语对象仅该频道显示。合成composition状态配nativeEnter未发送，明确不冒OS IME候选窗口。

21-04-24 keyboard-only raw PASS，resolutions=[]、无新图或旧capture/鼠选重跑：普通中文草稿“键盘频道草稿”，原生Tab到密语radio、Enter切换后btnPrivateChannel与唯一input焦点/草稿保持。末驱动沿现成功合同keyDown Enter text='\r'，无共享生产修正。首FAIL保持，组合范围以accepted索引为准；两run均无聊天发送、关系写入、BUY/建房/Ready/对局。三原整图均亲看，菜单聊天/密语/好友文字与原框可辨。

Focused Webtypes exit0；主线queued-part-map-channel-web-build.log strict types+Vite1m26s exit0已包含stable消费及suffix，无独立全build。专属3416/5446/9646及临时sqlite/Chromium目录均finally清理。建议UI03六控件/当前可用选择本片原位记录，原菜单producer/GM权限/完整字体与UI01全窗口父不勾。

主审lobby-channel-shared-consumers-main-review.json接受六控件/三res主要信息与普通选择、鼠标capture和原生Tab/Enter尾段的组合，UI03当前菜单业务登记；UI01与原位置/字体/完整路由父未关闭。queued-part-map-channel-web-build.log统一Webtypes/Vite通过，未新增页面验收。
