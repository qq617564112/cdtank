# 房间卡片原分页与选房验收（M5-02-C-PAGING）

`browser-room-card-paging-accepted.json` 收录5个完成检查范围、19张有效 PNG，以及独立键盘完成字段。三分辨率检查来自 raw `02-22-11-624Z` 的 checks0–2，原FAIL保持；上一页Hover补片 `02-28-01-431Z` PASS1，正式加入退出补片 `02-28-36-093Z` PASS1。raw未完成范围不采纳，错误图保持独立。原来源见 `room-card-paging-source.md`。

专属服务通过正常API创建12房与系统5房，共17个真实房间，目录按原十槽显示两页。800×600、1920×1080、3840×2160分别观察第一页1 / 2的R1–R10、末页2 / 2的R11–R17，原上下页源控件普通鼠标完成两向翻页。第一页上一页与末页下一页使用原DisabledImage，点击不能越界；普通选末页R17、返回第一页后当前选择仍在可见有效目录。源矩形、615×321舞台比例、−84偏移、真实按钮elementFromPoint命中与源文字窗口均通过。现卡片命中不受分页容器覆盖。

两按钮Normal/Hover/Pushed/Disabled均使用原源图，alpha1，图层pointer-events:none。每种分辨率实际截图的源PNG同质3×3不透明内区按目的矩形投影，9–69个样本逐RGB一致；边缘插值不作为此内区检查。`room-card-paging-pixels-2026-10-04T02-22-11-624Z.json`覆盖16图，上一页Hover补片再覆盖3图；共同包含上下页全部图态。

页数的数字、空格和斜杠均有原atlas glyph。三分辨率与原尺寸补图记录96/103/192原mono面及glyph位置、完整extent、居中和裁剪。斜杠样本检查源opaque坐标投影后的实际白色alpha与当前面板RGB合成；103面在fractional缩放时边缘混合，不将其称为完整原framebuffer等价。新增原斜杠来源与旧454对象/RGBA保存检查由独立字体证据约束。

`02-25-18-960Z`的独立keyboard字段记录可信Tab找到下一页、Enter到末页；按钮随后disabled，浏览器焦点移至BODY，此行为明确记录。再可信Tab找到可用上一页，Space回第一页，两禁用边界均不能继续移动；Join前world为null。该raw退出超时不采纳。最后普通源下一页、R17选卡与普通Join获得同roomId/playerId的权威WAITING且地图载入，打开正式等待窗口后用源关闭按钮正常Leave，网络Join/Leave响应均成功、world清空。

## 边界

原count/page启禁算术已经执行恢复，当前目录数据来源及刷新/排序/选房生命周期、页数字符串格式仍是明确Web投影。原全屏锚点、完整Windows/GPU截图、工具栏与编号消费者留父项；本片不关闭整个大厅。共享SourceButton仅扩大suffix类型，状态逻辑没有修改；字体资源仅追加U002F，不重排原字形。所有3311/5333/9533进程与临时目录已清理，统一Web工程由主agent集成。
