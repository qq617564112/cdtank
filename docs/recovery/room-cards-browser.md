# M5-02-C 房间卡片浏览器验收

`node --import tsx tests/browser-room-cards.mjs` 通过。结果：`recovery/output/browser-room-cards.json`，11 项场景；截图 `browser-room-cards-1080p-cards.png`、`browser-room-cards-4k-cards.png`、`browser-room-cards-4k-waiting.png`。

真实隔离服务端 3189、Vite 5224、Chromium 9294。以普通账户/CreateRoom/Join/Ready/ChangeTeam 建立 R6–R17，加上五个默认房间，共17个真实房间。R6 实际队伍人数从 [1,1] 经 ChangeTeam 更新至 [2,0]；R7 为密码房；R8 两名真实玩家 Ready 后成为满员 PLAYING；R9 为混战。

验收覆盖：

- 原 `roomlist_icon.xml` 的编号、名称、队伍人数、混战总人数、密码和游戏中标识映射到真实 ListRooms；名称按服务端返回值展示为文本。
- 原图片成功解码；普通鼠标经过与移出切换 Normal/Hover，选择切换 Pushed，同时更新正式目录所选房间。
- 普通分页、第二页选择、刷新保留身份、EMPTY 全目录排序。
- 卡片加入调用普通 Join，错误密码拒绝，重开卡片保留选择与密码草稿；正确密码进入真实 WAITING，玩家身份与响应一致。
- 1920×1080 和 3840×2160：615×280 源舞台按比例缩放，十卡位置与对话框位于视口内；4K 普通翻页、选择、输入与加入可操作。

实际截图显示队伍、混战、密码及游戏中卡片，源卡片宽度保持，长房间名限制在原名称区域。未注入对局位置、伤害、状态或胜负。运行结束专用服务端、浏览器、Vite 与临时账户目录均清理。

## 来源范围

图片与坐标来自已提取原客户端 UI。字段与当前权威房间的映射、排序、分页和加入路由为重建规则；本验收不证明原分页收发回调、模式贴图语义或完整大厅复刻。

键盘专项 `CDTANK_ROOM_CARDS_KEYBOARD_ONLY=1 node --import tsx tests/browser-room-cards.mjs` 通过；`browser-room-cards-keyboard.json` 保存独立结果。最终源代码在全新页面载入，两间实际 API 创建房间；普通 Tab 到 R6、Enter 选择后焦点仍在新建的 R6 卡片，继续 Tab 到 R7、Space 选择后焦点仍在 R7，正式目录与 aria-pressed 一致。专用进程与目录均清理。此专项仅覆盖键盘焦点修改。
