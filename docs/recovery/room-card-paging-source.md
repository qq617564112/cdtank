# 房间卡片原分页控件（M5-02-C-PAGING）

正式 RoomCards 的上一页、下一页与页数使用 roomlist.xml 的 btnPageUp、btnPageDown、yeshu，删除对应三个 Web toolbar 控件。排序、刷新、加入和关闭保留原接线。舞台为原 all 的615×321范围，卡片十槽相对位置保持原投影；分页容器 top−84抵消 sourceProps 累加原all.top84。SourceButton 只新增 roomlist.xml suffix，共用状态和事件不变；SourceStaticText 共用接口不变。

原 all=(0,84)-(615,405)，ditu=(0,0)-(615,316)。btnPageUp相对all=(176,274)-(202,311)，btnPageDown=(484,274)-(510,311)，均26×37。yeshu相对ditu=(557,261)-(607,276)，50×15，默认SIMSUN、显式四角FFFFFFFF、HorzCentred、默认VertCentred。原矩形及页数与第十槽相邻区域保留，不调整位置美化；分页控件按源顺序置卡片之后。容器不接pointer events，按钮恢复auto，源glyph与image子层不截获命中。

room-card-paging-native.py原执行四完整WLButton draw入口，16状态/alpha向量核原Normal/Hover/Pushed/Disabled均有图片；捕获状态复用五原ButtonBase向量。原EXE0x5056b3..0x5056f0读取当前页+20及目录count，令上一页enabled=page>0，下一页enabled=count>(page+1)*10；12向量覆盖0/1/10/11/20/21/30房与各边界。count查询与setEnabled端点是provider，边界整数算术执行原代码。正式busy额外禁用、目录选房/刷新/Join生命周期保持既有Web规则。

## 页数斜杠原字形

既有454字符SIMSUN atlas不含U002F。room-card-page-font-native.py复用waiting原FreeType类，仅执行原Init/NewMemoryFace/SetCharSize/LoadChar，对原MINGLIU.TTC face0、9point、flags0x1004分别取得96/103/192 DPI三个斜杠mono bitmap与advance/ink。每个atlas末尾追加一个glyph，原454字形对象（全部坐标、ink、advance等）逐对象相等，原PNG完整RGBA区域逐字节相等。输出room-card-page-font-native.json PASS3；未重执行454字形循环或覆盖历史waiting字体证据。当前资源每面455字符，页数数字、空格、斜杠均从原atlas绘制。

## 边界

页数「1 / 2」的字符串格式、空目录0/0与页身份仍为Web投影；原格式生产者、全页window锚点/背景截图、编号、工具栏与完整网络回调留父项。原完整Windows/GPU显示未取得，字体只证明有限原mono采样与当前缩放投影。最近DPI选择和stage scale上限3沿现有Web消费，不声明完整原OS字体重生成。

追加脚本再次运行时验证现有U002F原glyph/alpha、全部旧454对象与历史字体基线，不再次追加或修改资源；输出独立 room-card-page-font-native-verify.json，保留首次append来源。页数所在容器为独立绝对定位 span，实际尺寸与源矩形一致，避免inline span忽略源left/top。
