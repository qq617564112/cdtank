# 房卡原开新房间入口（M5-02-C-CREATEENTRY）

正式RoomCards显示原roomlist.xml的btnCreateRoom：相对all位于(203,271)–(297,313)，94×42；复用已有pagination容器top−84，抵消sourceProps累加all.top84。控件为WindowsLook/Button，StateColorBlend=False、UseStandardImagery=False，Normal/Hover/Pushed各使用原lobby_anniu20开新房间图，无DisabledImage。共用SourceButton/room-source-page-button样式，未改CSS或共享button消费者。

room-card-create-entry-native.py执行原WLButton四完整draw入口，四state×alpha1/.5共8向量，原Normal/Hover/Pushed图片与四角alpha一致，Disabled零draw。捕获/鼠键逻辑复用既有原ButtonBase消费者及room-card-button-native.json，不另设状态规则。

RoomCards只新增createEnabled与createRoom两个父接口，源按钮disabled=busy||!createEnabled，点击调用父createRoom。RoomControls沿既有账户/地图/忙状态提供创建资格，原有刷新pending也禁用；点击记cards来源并打开已有React RoomCreateDialog，目录保留为模态背景。Cancel/Close/Escape关闭建房对话框，焦点回已挂载的源create按钮，不改变目录页/选择/排序。创建确认仍调用同一普通CreateRoom入口；权威WAITING成功后关闭目录与创建窗口。左侧原有创建入口记录controls来源并保留返回焦点行为。

## 边界

原完整create callback未恢复。源按钮资源、位置、draw/capture为原消费者，创建资格、现React入口与返回来源状态为明确Web业务接线；原服务端/完整大厅布局/GPU framebuffer留父项。本片不修改协议、房间规则、字体、场景或目录比较器，不代表完整大厅1:1。
