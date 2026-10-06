# 原房间排序按钮视觉消费（M5-02-C-SORTBUTTON）

正式RoomCards在原roomlist.xml排序位置显示btnSortByEmpty或btnSortByID，取代toolbar的Web排序select。两个原按钮都相对all位于(391,271)–(482,313)，91×42；既有分页容器top−84抵消sourceProps累加all.top84。共用原SourceButton与room-source-page-button样式，无共享组件或CSS变更。

原两个控件为WindowsLook/Button，StateColorBlend=False、UseStandardImagery=False，分别有Normal/Hover/Pushed三图。无DisabledImage；busy时原按钮不绘制图片，透明底且不允许触发，未回退Normal图。room-card-sort-button-native.py复用原WLButton完整机器码入口，两个按钮×四state×alpha1/.5共16向量全部通过，Disabled零draw，其他state选精确图片/四角alpha。原captured-state来源复用room-card-button-native.json，事件实现未改。

room-controls.tsx的RoomCards busy参数合并既有busy与refreshing，真实刷新等待期间禁止依赖陈旧目录排序/选房/翻页；该hunk由主agent负责，响应后沿refresh finally恢复。

当前ID排序显示“空房间”源按钮，点击调用已有changeSort('EMPTY')；EMPTY显示“编号排序”，点击changeSort('ID')。该目标切换为明确Web状态投影，同一个DOM按钮随state更新source，可信Enter/Space后焦点保留。aria-label说明目标，title说明当前与目标；完整编号、中文草稿、排序比较器、分页与合法选择规则保持既有业务。

## 边界

EXE有btnSortByID/btnSortByEmpty名称字符串0x5d589e/0x5d587e，本片有界直接code引用查找未取得原visibility/callback。按钮的原资源、坐标、draw与capture来源明确，目标切换/比较器/选房生命周期仍为既有Web重建；原完整排序回调及大厅完整窗口/GPU显示留M5-02父项未完成。本片仅交付正式源按钮视觉与真实排序闭环，不宣称原回调恢复。
