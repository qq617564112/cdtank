# M5-02-CM 原房间玩法图标网页验收

`node --import tsx tests/browser-room-mode-icons.mjs`：PASS。

独立 TSRPC 服务端正常启动五个系统房间 R1–R5，普通账户网页通过原房间卡片入口打开、刷新与选择。网络捕获验证真实 ListRooms 响应的 mode1–5；未注入房间、玩家或战斗状态。

| Web mode | 原引用 | DDS 区域 PNG |
| --- | --- | --- |
| 1 团队 | `set:gy0 image:data\ui\gy\0.tga` | `ui/regions/60/80.png` |
| 2 占领 | `set:gy0 image:data\ui\gy\1.tga` | `ui/regions/60/79.png` |
| 3 擒王 | `set:gy0 image:data\ui\gy\2.tga` | `ui/regions/60/83.png` |
| 4 混战 | `set:gy0 image:data\ui\gy\3.tga` | `ui/regions/60/82.png` |
| 5 破坏 | `set:gy0 image:data\ui\gy\4.tga` | `ui/regions/60/81.png` |

验收逐项比对 `picGameMode.dataset.sourceAsset` 与 DDS 优先的原 imageset 引用解析结果、实际 CSS 背景、浏览器 PNG 解码、可见矩形和原布局位置（42,7；79×22）。五种已知模式图标无文字覆盖，保留模式名 title；ID 顺序及 EMPTY 排序后各房间对应原图不变。原生鼠标选择 R3、键盘改排序和普通刷新后保留 R3。

1920×1080 与 3840×2160 下五个图标全部位于视口内；保存实际网页截图并检查五张模式标题均可见。共四组专项场景通过。截图证明当前网页实际显示，不宣称 Windows 原帧缓冲像素等价，也不关闭房间目录完整收发回调父项。

结果：`recovery/output/browser-room-mode-icons.json`；截图：`browser-room-mode-icons-1080p.png`、`browser-room-mode-icons-4k.png`；服务端日志：`browser-room-mode-icons.log`。独立端口3190/5225/9295和临时数据库／浏览器目录已清理。
