# 正式等待房间整页（M5-03-R-PAGE）

正常WAITING路径直接打开原room_main.xml窗口。BattleMatchView在正式waiting阶段只呈现原WaitingRoomView与必要CPU/托管事务，不再输出临时准备按钮、重复换队按钮/名单、目标标题与手动“查看原等待房间”入口。validation入口保留旧验证视图。

原SheetWindow为615×391、无Image/frame透明根。既有原frame、地图名称/说明、名单12槽、战车、准备状态、模式/友伤、Ready/Cancel、猫狗选择、邀请与Close均直接复用正式源消费者；不重复字形、图片裁剪或字体取证。源证据沿M5-03-R-VISUAL/BUTTON/W/I/X等已完成切片。

WaitingRoomView新增formal呈现属性和management ReactNode插槽。正式会话初始open=true，已有showModal生命周期直接开启；源Close仍沿原确认Leave请求，phase/room/round更替沿既有key和generation清理。正式Escape保持等待页，退出使用源Close；validation原Escape关闭展示窗保持。准备/换队资格、externalBusy/pending、源拒绝通知和权威状态确认没有修改。

CPU添加/移除和本人AI托管使用已有BattleMatch请求入口，以独立Web事务区域放在原窗口下方。仅这些业务按钮和必要状态，不重复玩家名单或源准备/队伍控件，不声称原客户端CPU/托管按钮已有对应资源。BattleMatch store/class、网络、服务器、账户与场景没有修改。

## 边界

现透明源窗口stage比例、居中投影沿既有Web等待展示，不宣称原高清renderer/window锚点或完整Windows framebuffer等价。CPU/托管事务区域与正式Escape策略为Web交互。原完整153控件、房主开始及未取得的玩家档案/头像等仍由未完成父项保持。
