# 大厅密语对象原菜单

UI-05 / UI-01 / M5-12。原3控件菜单消费当前真实大厅玩家，已获主线亲审限定接受；完整聊天和大厅父项保持未完成。

## 来源与归属

`chat_intimatelist.xml` 原 all (78,35)118×124、biaoqingfuhaokuang118×123与 lstIntimate(5,6)108×111。菜单消费原八框/中心图/名单选中图，当前 Web 附着(78,441)位于输入区上方；动态挂载和原名单生成/筛选语义未证实。完整属性与原 toggle parent chain 保存在 `lobby-intimate-source-page-source.json`。

UI owns `lobby-chat-intimate.tsx/css`、LobbyChatView 的 `presence?: Pick<LobbyPresence,'getSnapshot'|'subscribe'>` 只读订阅与菜单消费；主线 owns App 传既有 battle.lobbyPresence。没有新增 start、refresh、poll 或路由。

名单显示当前返回的完整 players，保真实 accountId/name，不猜原排序/筛选/好友目录。目录明确标记 `web-confirmed-lobby-presence`，选中行采用原 SelectionImage，超出名单区采用 Web 原生滚动；原 CEGUI scrollbar producer 未恢复。

普通选择调用现 chat.chooseTarget，保留 draft 与 selectionStart/End 并恢复原输入焦点。表情/对象菜单互斥；仅各自关闭自己的 outside 事件，避免选择行被另一菜单卸载。根 Escape 先隔离并阻默认，组合中保持、结束后关闭回源 toggle。密语昵称输入沿现业务，仅补 composition ref 防止对象 toggle 夺焦点。

## 首次验收范围

两个正常大厅账户、真实 LobbyPlayers 只读响应；800×600、1920×1080、3840×2160 完整大厅新名单页，三源控件与源图可辨。鼠标选择第二账户、键盘名单操作、取消/源toggle焦点、拖外capture取消、中文 draft/caret、组合输入与菜单互斥。0send/room/BUY，不重现好友资格/多端投递/已验表情整菜单。

原 popup/目录/回调/scrollbar、全UI01/M5-12与1:1保持未完成。

## 实际证据

`browser-lobby-intimate-source-page-2026-10-04T22-31-28-483Z.json` PASS。两个正常大厅账户登录，仪器仅保 Account 确认 accountId、不保 token。名单两个 accountId/name 与真实 LobbyPlayers 响应一致，没有名单或资金夹具。

800×600、1920×1080、3840×2160 三完整大厅图逐张查看，3原控件、8frame与中心图/两个真实姓名可辨，图片解码与viewport范围通过。真实源toggle按下/捕获/拖外/释放取消正常；鼠标选择第二账户以及Home/End/nativeEnter选择，均经现chooseTarget确认目标ID/昵称，保“对象中文草稿”、caret5及原输入焦点。更改本地候选后Escape取消保持已确认目标，焦点返回源toggle。

昵称输入合成composition状态与真实鼠标/nativeEscape验证保持焦点/菜单，结束后Escape关闭；不宣称OS候选窗口。对象和表情菜单切换保持互斥，全部菜单键盘window漏键为空。没有send/room/BUY或新增关系写；端口3425/5455/9655与临时库已清理。

专属与主线聚合Webtypes exit0，统一 `lobby-intimate-production-web-build.log` exit0/1m22 已含最终App/presence消费者。主线亲看三图并核代码/raw，交片索引 `lobby-intimate-source-page-accepted.json` mainReview 已记录。真实超长目录滚动未验，原滚动消费者和完整父项仍未恢复。
