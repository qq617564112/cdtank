# M5-02-C 原房间卡片选择与加入

从正常大厅“房间卡片”入口打开原十位置的选择面板，现有分页、排序、刷新和加入使用同一权威目录与选择状态。卡片仅选择；加入按钮关闭面板后走正常既有Join，密码错误显示既有反馈并保留页/房/密码，重开面板恢复选择；成功进入正常WAITING。此面板是原控件资源/坐标接入的Web流程，不宣称原房间列表全部窗口或原回调恢复。

## 来源与显示

roomlist.xml的picRoomIcon0–9为5×2源位置；roomlist_icon.xml的btnRoom NormalImage/HoverImage/PushedImage及picLock/picStarted、队伍人数底图和猫狗/个人图直接解析ui.json资源映射。原子控件矩形按祖先矩形累加，源sheet615×280以真实视口缩放。room-cards独立拥有modal/资产读取/卡片表现；共同布局解析从home移至interface/resources/source-ui-layout，home保留兼容重导出，原行为不改。

roomlist_icon有txtRoomID/name、两队人数与总人数；服务器ListRooms补可选teamPlayerCounts，由当前room.players的实际team0/1计数，旧服务器缺失字段显示—而不补零。个人模式只显示真实总人数；锁依据hasPassword，对战中依据PLAYING。满员/PLAYING沿现有canJoinRoom禁选择加入，FINISHED保持既有再战加入行为。玩法动态图标producer与身份现已由M5-02-CM原执行和真实网页关闭，按原0..4映射显示gy0五图，证据room-mode-icon-runtime.md。容量/满员/待再战详情和模式资格是重建Web展示；图像来源不能代替原服务器语义。

房名使用textContent与原矩形裁剪、完整aria-label；不将房名解析为HTML。未知源引用不猜配。资源未载入或布局缺失给出错误并可关闭重试，不允许资源错误冒充成功。

## 接线和验收

客户端room-controls统一计算有序分页后调用RoomCards.update；卡片动作回到现有select/change、排序、上下页、刷新和Join入口。服务端仅增加只读目录字段，schema可选追加保持旧请求；不改战斗规则/结算/账户保存。必要验收失败假设：队伍数字由总人数猜造→改World当前team计数；卡片选错页房/拒绝后丢选择→统一目录selectedId；资源背景错误→按原imageset引用；房名注入→textContent；高清源控件越界→viewport scale与modal布局。

browser-room-cards.json实际17房/11项全部PASS：原图资源解码与Normal/Hover/Pushed鼠标状态、team[1,1]→[2,0]权威ChangeTeam刷新、锁与满员PLAYING禁选择/个人总人数、跨页/EMPTY/刷新选房保持、密码拒绝后重开保留草稿/普通成功JoinWAITING身份一致、1080p4K源十位置舞台比例与视口/正常翻页操作。原房名由服务端清理尖括号，验收按权威返回文字/无DOM子元素核对，不宣称原字符串精确等价。主agent看实际1080p图，图像与数字可见；C原验收时文字模式；当前五图接线与最终证据归M5-02-CM。修复重绘丢失焦点后仅运行fresh源码两房键盘专项browser-room-cards-keyboard.json，Tab+Enter/Space选房后焦点/aria-pressed/#room一致PASS。最终全仓类型、262模块边界、既有分页/排序和两侧发行通过，最终Web1m23s包括焦点修正（room-cards-types/boundaries/pagination-baseline/build-server/build-web/protocol.log）。3189/5224/9294与临时数据清理，Sol停止。本片M5-02-C已勾选，完整M5-02/UI-05未关闭。类型、分页/排序和运行边界/两侧发行按本次受影响范围执行；无需重复CPU五模式两局或账户重启，基线复用已有有效证据。

命令：npm run test:rooms:cards:browser；CDTANK_ROOM_CARDS_KEYBOARD_ONLY=1 node --import tsx tests/browser-room-cards.mjs（最后焦点修正独立专项，不重跑17房）。说明room-cards-browser.md，来源room-cards-source.json。
