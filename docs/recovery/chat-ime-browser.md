# 中文组合输入聊天浏览器验收

运行 `npm run test:chat:ime:browser`，或 `node --import tsx tests/browser-chat-ime.mjs`。脚本使用独立服务端 3202、Vite 5234、Chromium CDP 9304、临时账户数据库和配置目录。

两个独立浏览器账户通过普通页面认证、创建和加入同一房间，在等待阶段及双方普通准备进入 PLAYING 后发送中文。浏览器使用 `Input.imeSetComposition` 创建和更新真正的 Chromium 预编辑状态；原生 Enter 在组合期间不得触发 RoomChat。`Input.insertText` 提交已选择的中文，产生实际 compositionend，随后普通 Enter 提交唯一 RoomChat 请求，服务端成功确认且双方收到相同中文和发送者身份。

脚本仅安装事件监听器记录 compositionstart、compositionupdate、compositionend、input 和按键事件。每次流程独立检查事件先后顺序、insertCompositionText 和 isComposing。组合期间 W、Space、Digit5、F5 不产生聊天、移动、开火或道具业务动作；周期性的空 PlayerInput 允许。组合 Escape 保持聊天焦点，通过空 imeSetComposition 取消预编辑后，普通 Escape 返回画布。重复 Enter 不追加消息。

在真实预编辑过程中离房并正常重入后，草稿和日志清空，新组合输入仍可正常提交。个人模式选择队伍频道真实触发 CHAT_REJECTED，已提交的中文草稿保留，日志不追加。1080p 和 4K 检查聊天控件边界与排列并保存可见截图。

## 验证边界

CDP 操作 Chromium 的组合输入状态，不驱动操作系统输入法候选窗口。原生组合 Enter 验证隔离；选择结果的提交由 Input.insertText 完成。Escape 的候选取消由空 Input.imeSetComposition 完成，随后检查普通 Escape 返回。未验证操作系统候选窗口、候选列表导航或具体输入法词库。

证据保存为 `recovery/output/browser-chat-ime.json`、`.log` 和同名前缀 PNG。JSON 含实际事件序列、解码后的网络请求/响应/事件、真实 WAITING/PLAYING 快照、控件几何和清理结果。只读取资源就绪状态，未注入对局、回包、身份、队伍或生命值。完成后专属服务器、Vite、Chromium 关闭，临时目录删除。
