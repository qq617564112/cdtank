# 收到中文／多表情消息排版浏览器验收

M5-12-E-R：真实双账号同队、第三名 CPU，正常 Ready 进入 PLAYING。普通 Enter 发送的中文、ASCII、不同宽度表情和跨行重复表情，通过原频道按钮分别提交公共／队伍 RoomChat；TSRPC 二进制请求、成功响应和双端 RoomEvent 的真实 playerId、频道和整条消息一致。双端收到行的源宽度、Web 字体字宽、分行和每个片段逻辑 advance 一致。

运行：`node --import tsx tests/browser-chat-rich-layout.mjs`。

| 验收项 | 结果 |
| --- | --- |
| 中文、ASCII、表情 1／26／6／30 混排 | 两行，完整文本／glyph 顺序保留 |
| 同 provider 1 跨行重复 | 同次 DOM 观察的 elapsed、frame、图片源一致 |
| 原表情逻辑 advance／绘制矩形 | 源宽 16–50，源高 14；绘制左偏 1，宽为源宽减 1；行推进 16 |
| 实际 Web 字体临界消息 | `12px CDTank-SIMSUN, serif`，真实发送者前缀宽 48；31 个 W 加表情 26 共 284，落于宽 286 首行；32 个 W 共 290，表情换至第二行 |
| 日志溢出后重新排版 | 可用宽 286 减源滚动条 14.3，得到 271.7 |
| `<emote name=001/>`／`<tag>` | 队伍消息双端逐字保留，无标签 DOM／表情替换 |
| 原滚动条 Home／End | 实际富文本总高 128、可视高 94、范围 34；Home 可见混排，End 可见最新字面消息 |
| 正常退出／新 WAITING | 富文本行、片段和表情节点清空，WAITING 不保留 source rich 布局 |
| 专属资源清理 | 3208 服务、5240 Vite、9310 Chromium 均停止，临时数据库／浏览器目录删除 |

验收只读 line／item／image 元数据和实际 DOM 矩形，输入、频道、Ready、CPU、滚动和退出均使用正常控件。1080p 和 4K 均为 DPR 1，UI 按原 800×600 源布局缩放；3D 使用硬件缩放 8，画布分别为 240×135、480×270，本验收不提供 FPS 结论。

证据：

- [请求、响应、收到消息、分行和清理 JSON](../output/browser-chat-rich-layout.json)
- [服务日志](../output/browser-chat-rich-layout.log)
- [1080p 混排历史](../output/browser-chat-rich-layout-1080p-mixed.png)
- [1080p 最新字面消息](../output/browser-chat-rich-layout-1080p-latest.png)
- [4K 混排历史](../output/browser-chat-rich-layout-4k-mixed.png)
- [4K 最新字面消息](../output/browser-chat-rich-layout-4k-latest.png)

## 边界

收到 TSRPC Unicode glyph 经现有表情映射投影为源 provider；Canvas.measureText 提供 Web 字体字宽，原布局内核决定文本像素边界分割和表情推进。字宽不声明为原客户端字体测量值。未知标签保持字面是 Web 文本适配，不声明收到任意 XML 与原 XML 解析器等价。源布局内核的原函数执行证据由 `chat-rich-layout-source.json` 单独记录。
