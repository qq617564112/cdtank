# 等待房间提示层来源缺口

UI45 / M5-03。`room_main_dialog.xml` 仅含 wndDialog 和 txtMessage：原800×600根矩形(235,238)–(564,334)，文字相对(29,18)–(300,75)，水平居中。布局本身已确认。

## 未完成范围

根图引用 `set:zhandou00 image:data\ui\zhandou\tishikuang.tga`，原 DDS/TGA 两个 zhandou00 imageset 与现导出目录均无该条目；不能以其他弹框图片替代。一次具名 CDTank PE 字符串引用查询未定位布局/control identity，文本 setter、显示时机和输入阻挡语义仍缺。

`room-main-message-source-preparation.json` 保存布局、图片引用及依赖，`room-main-message-source-lookup.json` 保存有限原二进制查询结果。没有 production import、状态映射、截图或 runtime 验收，不将现 Waiting pending/error 当作原 producer。
