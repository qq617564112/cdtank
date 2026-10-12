# 中文组合输入聊天闭环（M5-16-C）

正式入口为 `interface/battle/battle-chat.ts`，等待、战斗、结算共用同一个聊天控件。预编辑由浏览器 input 与 composition 事件维护，客户端只在已结束组合且没有待确认请求时向 `network/rooms.ts` 发送正常 RoomChat。服务端沿用既有身份、当前房间和频道资格判断；成功广播后确认，客户端收到成功才清除相同草稿，拒绝保留原文字。离房 clear 增加 generation 并重置组合、草稿和 pending，旧请求不得修改新房间。

现有防护包含 compositionstart/end、KeyboardEvent.isComposing 与 keyCode229；组合期间 Enter 不触发表单发送，文本控件焦点释放战斗按键，W/Space/Digit5/F5不得产生移动、开火、道具或快捷聊天。普通空 PlayerInput 定时消息仍可能发送，不用“没有任何包”替代动作隔离断言。

原普通房间/战斗编辑框上限72的依据复用 chat-channel-source.md。浏览器组合事件、UTF-16长度、房间频道0与队伍频道1、业务确认和焦点返回沿现有明确重建合同；不宣称恢复原CEGUI输入法、全部频道或Windows候选窗口。历史 browser-room-chat.json 的IME检查仅为合成DOM事件，本片必须提供 Chromium Input.imeSetComposition/Input.insertText 产生的实际组合事件及真实双端请求/广播证据，不能将旧合成检查视为候选输入已完成。

验收入口：`npm run test:chat:ime:browser`。浏览器专属文件为 browser-chat-ime.mjs、chat-ime-browser.md 与 browser-chat-ime 输出；实际状态由 tasklist.md 维护。生产资格、账户、CPU、渲染资源与源图未改时复用已有保存/两局/表现证据，不重复全模式回归。操作系统候选UI与全部65布局仍属M5-16父项，不随本闭环关闭。
