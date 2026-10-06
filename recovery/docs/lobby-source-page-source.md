# 正式大厅整页原框架（M5-02-R-PAGE）

正式大厅使用同一800×600原Sheet坐标，把默认主背景、房间目录、玩家列表框和聊天区域组成常驻页面。原房卡大dialog的Web边框、padding、工具栏不进入正式页；既有房卡、源文字与按钮消费者直接呈现在原roomlist位置。独立validation.html保留验证表单与工具。

原default.xml的picMainBackground为(0,0)–(800,600)，Image beijingditu0/data\ui\beijingditu\datingditu.tga，当前DDS源55/1.png为400×300，原HorzStretched/defaultVertStretched。roomlist.xml根all为(0,84)–(615,405)，原615×321房间区在此定位；该区已有ditu、十房卡和主要源按钮保持原消费者。右playerlist.xml haoyou为(610,97)–(800,600)，八frame与中心hylb9；标题datingmingchengditu累加后(610,52)–(796,98)，原玩家/好友标签资源呈现，名单区域(619,155)–(789,575)。正式在线名单由服务器确认的账户身份驱动，已接玩家/好友/黑名单筛选、玩家资料入口及关系操作；来源与业务范围见lobby-player-list-source.md、player-info-page-source.md和player-info-blacklist-source.md。

chat.xml SheetWindow为(0,402)–(612,611)，原lt八frame累加(9,426)–(603,558)，输入背景picNormalChat为(52,567)–(579,591)，edtNormalUserInput为(66,571)–(570,588)，ChatTextBox为(20,437)–(594,551)。既有主线LobbyChatView通过chatContent插槽使用这些全局坐标，原聊天框与输入条由整页消费者呈现。原跑马灯区域呈现普通页面操作结果；频道/实时消息业务属于M6-08-L。

lobby-source-page-source.py验证这些原矩形与DDS资源，输出lobby-source-page-source.json。Static frame/Image绘制消费者沿已执行waiting-room-frame-native.json、room-card-background-native.json与正式SourceStaticImage；已完成房卡/按钮/字体不重复开发。

普通原创建按钮先打开现有模式地图页，再打开原建房窗口。双击房卡和快速进入按钮接现有权威Join；锁房使用原userinput_dialog图片布局与现Join密码，拒绝保持密码草稿与房间选择。Home/Shop调用现React库存/商城，App保存真实源按钮焦点；库存与战车/宠物页共用原myhome625×404根框及源分类导航，来源见home-page-source.md和home-roles-page-source.md。其他玩家页面通过我的家事务导航可达。没有新增账户或对局规则。

## 边界

800×600统一比例居中、顶部昵称输入、双击/快速进入选中Join、密码prompt绑定及可见大厅五秒ListRooms更新是明确Web接线，不称原大厅回调、原快配协议或原renderer高清display已恢复。原picTopBanner没有Image，未虚构顶栏Logo。玩家/好友名单、资料页与关系业务已接现有权威账户接口；原客户端好友和私聊回调仍未恢复。整页框架已落地，完整原1:1/GPU/display与未知控件由未完成父项保持。

主背景为DDS55/1的400×300原蓝色datingditu图，按800×600窗口拉伸。PlayerTab/FriendTab与54×54选中图使用原绝对坐标；选中图自身构成图像定位父容器，内部SourceStaticImage图块保持54×54，不覆盖大厅根。正式玩家选中图位置为(636,97)，好友为(711,97)。原ImageManager的DDS/TGA选择及原客户端同状态framebuffer仍未取得，源图选择与完整高清精度保持M5-02/UI-46父范围。
