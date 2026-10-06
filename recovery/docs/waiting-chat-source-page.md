# 正式等待聊天整页

UI-01 chat.xml与UI-02 chat_channellist.xml，复用M5-12/M6-08当前BattleChat状态/请求/确认。现WAITING sourceActive=false，页面回退金框、默认select及Send；正式原完整等待页因聊天未迁移仍不闭合。

原room_main.xml根615×391@(0,0)，ditu615×400；chat.xml根612×209@(0,402)。lt@(9,426)594×132，ChatTextBox@(20,437)574×114，公共输入@(66,571)504×17，私语对象/内容分别@(92,571)100×16与@(203,572)367×16。主来源为原发布布局/ui.json，字段与发送取现真实BattleChat，不用原空控件猜业务。

UI归属新增waiting-chat-source-view/css+专属source/browser/doc，battle-chat-view.tsx仅正式等待分支及原session数据props。root owns App formal布尔；UI按已确认归属实现WaitingRoom formal定位/scale/management：现居中615×400+下铺Webmanagement会覆盖原@(0,402)聊天，需在同800×600等比viewport恢复主根@(0,0)、Webmanagement避开底部chat；validation旧布局保留。归属仅定位、比例与management呈现，Ready/CPU/Join/actions和cleanup保持现合同。

恢复静态root/框/普通与私语输入、原频道按钮/完整七控件菜单，继承同基准scale。日志保现rich文本/表情与滚动。频道0房间/1队伍/2密语/3好友均沿现业务；family/GM与未知对象列表/广告不造生产行为，必要既有输入选择业务保留。发送Enter沿原BattleChat.request，不新增protocol，generation/pending/成功清稿/拒绝保稿/快捷聊天与组合输入门禁保持。

验首次实际800/1920/3840完整等待页（主根+chat而非局部截图），两普通页面中文房间消息确认、一组本页原频道选择与中文草稿、真实无私语对象拒绝保稿、焦点隔离与日志滚动、普通Close清理；0Ready/BUY/对局/好友关系写入。旧权限/好友路由与所有快捷键持久验收复用。原挂接事件/font/完整UI01/02与1:1仍开放，来源欠缺字段留空。

首次实际记录：`browser-waiting-chat-source-page-2026-10-04T21-25-34-704Z.json` 为FAIL。两普通网页中文房间消息已取得成功响应及双端显示；三分辨率图均保存，但聊天控件被旧Web fallback的static/auto尺寸规则覆盖，图面不能作为整页可用证据。菜单选择后续操作尚未执行。原记录与图片保留，待明确消费者修正后的相关验收。

呈现边界：原SheetWindow延伸至611，正式Web聊天section在612×198的可用区域裁切，防止文档滚动条改变等待dialog的居中坐标；日志仍独立原生滚动。原客户端611区域的裁切规则未证明，本适配不计作原父裁切恢复。旧Web fallback仅对非正式聊天生效。

整页证据：`browser-waiting-chat-source-page-2026-10-04T21-33-11-768Z.json` 保存800/1920/3840正式完整图，主根/chat/输入/日志/右management均在视口，两个根相差402×scale；各图已实际检查，原10层chat框和中文消息可辨。四频道真实选择保留中文草稿并回输入焦点。该raw整体FAIL，后续Escape部分不作为通过。

键盘/表情证据：`browser-waiting-chat-source-page-2026-10-04T21-36-14-137Z.json` 为navigation-only，resolutions=[]无新图；beforeEscape确认焦点尚在频道开关，Escape关闭菜单、window漏键[]并严格回开关。30个源表情入口与001真实glyph插入通过。raw整体FAIL，密语响应检查尚未完成，不升整体PASS。

业务尾段：`browser-waiting-chat-source-page-2026-10-04T21-37-47-063Z.json` PASS，business-tail-only、resolutions=[]无新图。真实RoomWhisper返回WHISPER_OFFLINE，错误为“密语目标当前不在线”，中文草稿保留；8条正常RoomChat分别双端取得，日志scrollHeight128/clientHeight99，普通wheel后scrollTop0；两端源Close离房、聊天卸载、activeElement严格匹配enabled大厅Create。0Ready/BUY/战斗/关系写入。端口3418/5448/9648与临时db/Chromium按finally清理。

交付索引为`waiting-chat-source-page-accepted.json`，已由root亲审三最终整图及三raw有效段，接受组合可用范围，不改原FAIL状态。focused final Webtypes exit0；已有主线统一build覆盖前稳定版本，最后fallback/clip/Escape修改由主线waiting-chat-final-web-build.log统一验收。建议UI01/UI02当前主要输入、频道与表情消费者有限登记，UI04广告、原位置/父裁切/font/GM/对象列表及完整等待页1:1父保持未完成。
