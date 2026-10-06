# 场景拾取通知合同

M2-03 / M6-06。沿原两个具名字符串的直接注册引用取得新receiver，不重复拥有表或道具消费入口。[来源索引](../output/ground-pickup-receiver-source.json)保存虚表、包体指令与两个完整receiver的原反汇编。

| 消息 | 路由 | 包体 | receiver |
| --- | --- | --- | --- |
| UMsgPickupItem | 3c98 / packet5c53c8 | fieldC16、field1032、field1432、field1832、success1 | 441382，注册442595 |
| UMsgPickupTreasure | 3caa / packet5c53f0 | success1、field1032、成功时嵌套记录 | 44162c，注册4425d7 |

441382要求成功标志、fieldC对应ItemTable记录及场景provider。field10和413f60比较仅控制本机提示。receiver遍历manager+9c场景树，按物件定义与field14/18坐标窗口匹配，移除模型、刷新场景、通知可选+c0观察器，释放节点并erase。它不接收完整MyItem记录。

44162c要求成功标志、场景provider和manager+a8场景树中的坐标匹配。field10同样只控制本机提示与声音，远端成功通知仍执行场景移除。其两个模型名分别交4595f9移除，之后457ca0刷新、可选+c0回调、43ce02释放记录并erase节点。reader43fe8b为嵌套记录分配0x58字节并执行41dad0；它与0x30字节MyItem记录不是同一身份，不能把其中+4等字段偷换为拥有实例ID或库存量。

这两个receiver直接可见的合同是成功后的场景清除。没有直接调用43d583/43d122/440fd7，没有MyItem数量写入；未执行UI/renderer虚函数终端，不声称所有可选回调递归无写入。仍缺正常接触请求、拾取资格与服务端生成成功通知、类别6持久库存增加及治疗执行。不得把场景物件消失冒作账户取得，也不将这两个消息借作3c9e使用成功确认。
