# 等待页正式呈现状态浏览器验收

M5-03-R-PRESENTATION限定范围PASS37。`browser-waiting-room-presentation-accepted.json`列出35项本轮实际检查与2项加载/加载错误复用检查，保留原文件状态。主运行 `browser-waiting-room-presentation-2026-10-03T23-44-05-369Z.json` 为PASS35、14张整页PNG；server/Vite/Chromium与临时目录cleanup全true，3284/5314/9514已无监听。

运行 `node --import tsx tests/browser-waiting-room-presentation.mjs --states-only`。两个独立正常账户网页普通创建/加入mode1/map7团队房间，在800×600、1920×1080、3840×2160等待实际stage与SIMSUN atlas面完成更新。对应scale为420/391、2、2，字体DPI为103、192、192。脚本不注入房间、玩家、准备或玩法状态。

三个分辨率均确认：实际open窗口使utility及match直接Web节点不可见，match背景/边框透明；normal状态保留完整role=status文本，以1px/clip-path裁切；真实Ready提交期间状态条可见且按钮禁用、权威快照仍未准备；响应确认后源Cancel可操作，普通Cancel恢复未准备。800另用Tab/Enter完成普通换队并核双方权威快照。

三分辨率均执行真实RoomInvite拒绝，解码收到INVITE_EMPTY；原source notice可见，OK中心实际命中，父错误状态条可见。普通OK关闭后焦点回可用Invite或Ready，错误状态保持可读。Esc关闭保持WAITING，utility和match Web节点恢复；房主CPU按钮computed-visible且未禁用；重开再次收起Web chrome。最后两页各经源Close普通Leave，world、等待dialog与按钮消费者清空。

实际图检包括800 normal与4K cancel-ready，另核原拒绝notice整页截图。normal蓝色Web状态条和Web工具已收起，透明sheet后地图可见。

## 复用证据

- `browser-waiting-room-presentation-2026-10-03T23-33-53-066Z.json`整体保持FAIL，仅复用checks[0]真实ui.json延迟加载和checks[1]真实Fetch.failRequest加载错误；两项各有PNG与完整cleanup。
- `browser-waiting-room-button.json`为PASS，复用未变的source-button消费者精确hover/pressed/captured/selected/disabled图片与层顺序矩阵；本片实际重验Ready/Cancel、换队、pending、真实拒绝和普通关闭链。
- `react-match-2026-10-03T14-17-54-824Z-waiting-room.json`为PASS17，复用check[15]两人普通Ready自然进入PLAYING并自动关闭两页源dialog的React阶段证据。
- `browser-waiting-room-presentation-2026-10-03T23-35-20-145Z-interrupted.json`保留exit143及截图清单，没有持久检查结果，不纳入验收。

本片使用Vite实际编译与正式页面状态矩阵；前片Web build仅作为前片证据。

## 限制

CPU仅验证恢复后的computed可见和未禁用，不宣称本片执行了CPU操作或命中。源HUD/Chat继续保留；顶中空黄色区域是原game_main的picBattleInfoPanel图像，edtBattleInfo为空，现场rect/source记录见`waiting-room-presentation-hud-observation.json`。原WAITING HUD显隐来源与全业务/整页Windows对照仍在M5-03/UI-44父范围，本片不关闭这些缺口。
