# 正式大厅右侧在线名单（M5-02-R-PLAYERS）

LobbyPlayerListView 消费主线权威大厅账户身份与显示名，在原 playerlist.xml 的 PlayerList 中显示。原父 haoyou 位于(610,97)；PlayerList 相对父(9,58)–(179,478)，正式全局矩形(619,155)–(789,575)，170×420。背景和八个frame引用均为空，所以名单自身透明，保留原玩家框背景。Friend标签保持既有源静态图，没有虚构好友交互。

原 SelectionImage 为 mycabin00/data\ui\mycabin0\xuanzhong.tga，当前DDS裁图ui/regions/69/24.png为155×50。正式点击/键盘选择仅为本地行选择，使用该原DDS资源背景，不产生服务器身份或好友操作。账号ID是React key与data-lobby-player-account，文字直接使用主线name；移除账号时清除实际选择状态，重新出现不会恢复旧选中。↑↓/Home/End与scrollIntoView保持普通列表操作。载入/错误状态在列表内可见，状态为空时不占一行，该提示为Web业务状态。

lobby-player-list-source.py执行原WLListbox::getListRenderArea 0x1000ffd0四组纵/横scrollbar启隐向量。原list区域由边框inset与可见栏宽扣除，源八frame空使inset0。XML无frame和窗口源矩形、scrollbar尺寸/可见性为provider；原扣除运算实际执行。输出lobby-player-list-source.json PASS4并收录原SelectionImage路径与尺寸。

原CEGUIBase ListboxTextItem::getFont 0x1006b0c0直接选择显式font、owner Window font、System默认font。已完成来源显示应用System默认SIMSUN。getPixelSize 0x1006b110按Font lineSpacing及text extent四舍五入；draw 0x1006b210在selected flag与SelectionImage存在时提交Image draw，随后调用Font绘文字并用LeftAligned格式0。该三个本轮消费者为直接代码检查，不宣称原draw/字体光栅新执行。

## 边界

当前14逻辑像素行高、白色文字、已加载SIMSUN Web TTF光栅、DOM文档与键盘行为为明确Web投影，未把其称作原Windows全部list字宽/颜色/GPU/scrollbar消费。正式源纵栏及完整大厅长名单消费已有限主审，见 `lobby-player-list-scroll-source-page.md`；原factory栏宽、最终字体/GPU与完整1:1父项仍开放。正式业务的账户ID、登录别名和在线资格由M6-08-P定义，不称已恢复原玩家档案、好友列表或私聊回调。
