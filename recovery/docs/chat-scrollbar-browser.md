# M5-12-L 原战斗聊天历史滚动条浏览器验收

`node --import tsx tests/browser-chat-scrollbar.mjs`：PASS。

两套独立浏览器账户通过正常大厅建房、加入、同队、添加 CPU、Ready 进入 PLAYING。24 条公共中文历史消息及 2 条远端回归消息均由普通 Enter 提交；每条只有一个 RoomChat 请求，成功回执、两端广播和日志中的发送者身份一致。没有注入位置、消息、滚动状态或生产接口。

## 已验证

- 1920×1080 与 3840×2160、DPR 1：原 800×600 UI 等比缩放；滚动条 14.3×94、减按钮 28×26、增按钮 28×27，增按钮 y=67，轨道 42、滑块最小高度 40。滑块宽 28、上下片高度 28/17；父级剪裁，背景按 28×21 平铺。滑块位置随真实消息 scrollTop/extent 比例变化。
- 原 edtDisplayBox 图片属性准确映射到恢复 PNG：轨道背景、滑块三片，以及上下按钮 Normal/Hover/Pushed；全部实际 PNG 在浏览器成功解码。
- 实际鼠标上下按钮、轨道翻页、拖动滑块、聊天文字区域滚轮双向滚动；Home、End、PageUp、PageDown、ArrowUp、ArrowDown 均正常，Home 可见最早实际消息。
- 滑块获得焦点后 W、Space、Digit5 不派发非零战斗动作，也不提交聊天；允许正常零值 PlayerInput cadence。
- 查看最早历史时实际远端消息推进 `min(oldScrollTop + clientHeight + 16, newExtent)`；普通画布 W 按住期间收到远端消息后，移动输入仍保持非零。
- 退出清空消息；正常再建房 WAITING 不显示原战斗滚动条。服务、Vite、Chromium 和临时目录已清理，3207/5239/9309 无残留监听。

## 证据

- `recovery/output/browser-chat-scrollbar.json`：PASS、26 条请求/回执/广播、两端世界、15 项检查、资源解码与几何、真实按键和滚轮、清理结果。
- `recovery/output/browser-chat-scrollbar.log`：独立服务日志。
- `recovery/output/browser-chat-scrollbar-1080p-latest.png`、`-1080p-history.png`：1080p 最新消息与历史。
- `recovery/output/browser-chat-scrollbar-4k-latest.png`、`-4k-history.png`：4K 最新消息与历史。
- `recovery/output/browser-chat-scrollbar-1080p-waiting-cleared.png`：清空后的正常 WAITING。

## 边界

高清 UI 的真实浏览器几何与截图已验证；Babylon 画布采用硬件缩放级别 8，4K 时真实画布 480×270，不用于评估帧率。原生 RichEdit 文本测量和完整 CEGUI 未在本片复原；消息字体行距及 DOM 滚轮单位采用 Web 适配。原执行的字体行距驱动 extent、caret 判断分支与原生滚轮增量不由此浏览器验收宣称等价。
