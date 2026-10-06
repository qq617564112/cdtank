# 收到聊天 XML 语法浏览器验收

M5-12-E-X-B 通过。真实双账号同队、第三名 CPU，普通 Ready 进入 PLAYING；源公共／队伍按钮选择频道，普通 Enter 发送 12 条 RoomChat。实际 TSRPC 二进制请求、成功响应和双端 RoomEvent 保持真实发送者 playerId、频道及原消息字符串；展示按恢复的原包装／XML 语法解析。

运行：`node --import tsx tests/browser-chat-xml.mjs`。

| 验收项 | 结果 |
| --- | --- |
| 中文＋已知 glyph | 原 provider 001，白色文本与图像 |
| 闭合未知 `<tag>` | 去标签，保留子文本 |
| `&amp;`、`&#x41;`、`&#65;` | 分别显示 `&`、`A`、`A` |
| 未知 `&bogus;` | 原解析结果 `bogus;` |
| 显式 `<emote name=001/>` | normalized RGBA 全 0，图像 alpha 0，仍占源布局宽度并保留动画 provider |
| `<colour red=255 green=0 blue=0 alpha=255>` | 红色子文本，结束后白色尾文本；metadata 与实际 computed color 一致 |
| tag／实体／glyph 混合与中文／ASCII／多表情跨行 | 双端 parsed 展示、源 item 几何与身份一致 |
| 未闭合 `<tag>` 与截断 `<tag` | `parse-error`，空 lines／items；原消息身份保留，无字面回退伪造 |
| `<emote name=999/>` | 明确 `unsupported-source` 字面回退，无伪造表情 provider |
| 原动画 | 同 provider 重复图像 elapsed／frame／src 一致，001 自然访问两帧并使用原序列资产 |
| 原滚动条 Home／End | 真实总高 176，可视高 94，范围 82；历史与最新正常显示 |
| 正常离房／新 WAITING | rich line／item／emote 清空，WAITING 无 source rich 布局 |
| 专属资源清理 | 3209 服务、5241 Vite、9311 Chromium 停止，临时数据库与浏览器目录删除 |

验收只读 DOM、实际矩形和 metadata，动画只读 RAF 采样。输入、频道、Ready、CPU、滚动和退出均使用正常控件。DPR 1 下检查 1080p 与 4K 的 UI；3D 使用硬件缩放 8，4K 画布 480×270。本验收不提供 FPS 结论。

证据：

- [请求、响应、收到身份、parsed 行、动画与清理 JSON](../output/browser-chat-xml.json)
- [服务日志](../output/browser-chat-xml.log)
- [1080p 历史](../output/browser-chat-xml-1080p-history.png)
- [1080p 最新](../output/browser-chat-xml-1080p-latest.png)
- [4K 历史](../output/browser-chat-xml-4k-history.png)
- [4K 最新](../output/browser-chat-xml-4k-latest.png)

## 边界

本项覆盖恢复的收到包装与 XML 语法子闭环；M5-12-E-X 完整父项仍未完成。原 image manager、未知序列 provider 后果和表情图像 RGB 调制尚未恢复；`unsupported-source` 是明确的 Web 字面回退，不是原解析结果。字宽使用实际 Web 字体 Canvas 测量，不声明等同原客户端字体。原解析器与行遍历的执行证据由 `chat-xml-source.json` 单独记录。
