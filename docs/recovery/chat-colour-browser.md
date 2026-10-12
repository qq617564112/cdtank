# M5-12-E-X-C 普通消息彩色表情双端浏览器验收

状态：PASS。运行 `node --import tsx tests/browser-chat-colour.mjs`。

两份独立浏览器账户通过正常 UI 创建／加入同一房间，加入 CPU、两名真人 Ready 后进入 PLAYING。用真实输入框及 Enter 发送七种不超过 72 字符的普通消息：纯绿、纯红、部分 RGB 加半透明、默认白色 glyph、显式白色 RGBA、alpha=0、绿色显式 tag 加同 provider 的白色 glyph。公共与队伍频道交替，两端收到相同权威消息。

二进制网络证据逐条验证：单次 RoomChat 请求的 text/channel 保持输入；响应 playerId 属于实际发送账户；两端 RoomEvent 的 message/playerId/value 与响应及频道一致。接收数据没有注入业务状态。

| 验收项 | 结果 |
| --- | --- |
| 两端 1080p 实际接收表情 RGBA | PASS，14 组屏幕像素对照 |
| 绿色新动画帧两端复验 | PASS，2 组，实际 frame=1 |
| 4K 实际接收表情 RGBA | PASS，7 组屏幕像素对照 |
| 屏幕像素与源 PNG × RGBA | 23 组最大单通道误差 1/255；最高平均误差 0.069/255 |
| alpha=0 | 两端及 4K 诊断截图均为白色背景，像素误差 0 |
| 同 provider 重复表情 | 相同 elapsed/frame/src，各实例保留自身 RGBA |
| 自然动画换帧 | 两端及 4K 均观察到多帧，实例 RGB/filter/opacity 保持 |
| 原图绘制边界 | left=1、width=原宽−1、原图高度保持 |
| 正常退出／再创建 WAITING | 富文本项和表情节点清空，无旧 provider 内容 |
| 进程／临时目录清理 | 专属服务、Vite、Chromium 已结束，临时账户及浏览器目录删除 |

屏幕像素诊断使用真正收到消息后生成的 `img[data-chat-emote]`，临时移到白色板上，保留生产 SVG filter 和 opacity；SVG 定义仍在同一文档。截图取真实图像绘制区域，随后恢复节点及样式。对照读取当前帧源 PNG，按实际 width−1 尺寸缩放，以 sRGB 逐通道乘 RGB、按源 alpha×消息 alpha 合成白背景。诊断不会改账户、房间、聊天正文、provider 数据或游戏世界。正常业务页面另存 1080p 双端及 4K 全屏截图。

证据：`recovery/output/browser-chat-colour.json` 保存网络身份、实际行布局、动画样本、每次截图帧和像素统计；`browser-chat-colour-pixels-*.png` 保存像素诊断截图；`browser-chat-colour-1080p.png`、`browser-chat-colour-1080p-peer.png`、`browser-chat-colour-4k.png` 保存正常页面；`browser-chat-colour.log` 保存服务日志。隔离端口为 3211／5243／9313。

## 限制

此验收证明 Web 浏览器真实接收消息的屏幕调制与原 PNG RGBA 运算一致，未做原 Windows 客户端逐像素比较。UI 按 DPR1 的 1920×1080 和 3840×2160 验收；仅为控制测试资源将 3D hardware scaling 设为 8，没有 FPS 结论。原 parser 的 emote 属性缺省值是 0；默认白色由普通 glyph 的完整 RGBA 展开提供，显式白色 tag 也完整填写 RGBA。
