# 大厅原表情整菜单

UI-04 / UI-01 / M5-12。独立消费者接原32控件与现大厅草稿；完整大厅父项保持未完成。

## 来源与页面归属

`chat.xml` 的 btnExpandEmotion 经 SheetWindow (0,402)、lt (9,24) 累计定位为 (577,565)，27×27。原 normal/hover/pushed 图片通过既有 SourceButton 消费。

`chat_emotelist.xml` 包含 all (397,20)、biaoqingfuhaokuang 194×138 与30原 StaticImage glyph。消费原八框和中心图，不生成或补造图片；完整属性和 toggle parent chain 保存在 `lobby-emote-source-page-source.json`。当前菜单采用 Web 附着 (410,427)，位于 toggle 上方，原动态挂载 producer 仍未证实。

UI owns `lobby-chat-emotes.tsx/css`、LobbyChatView 的资源/整菜单消费及根 Escape 隔离；网络、频道、权限、发送和账户事务保持现 owner。现 emoteGlyph 解码与 LobbyChat.setDraft 接真实草稿：插入在 selectionStart，替换所选文本，恢复 caret 与输入焦点；超过现72字符上限保持原稿。

菜单使用共享原按钮捕获，组合输入时 wrapper capture 阻止 toggle夺焦点；根 Escape capture 先 preventDefault/stopPropagation，组合中保持菜单，结束后关闭并返回源 toggle。菜单关闭、外部点击和 window blur 沿现 UI 合同。

## 验收范围

首次完整大厅800×600、1920×1080、3840×2160检查原菜单全32控件/30glyph/八frame与toggle命中。普通鼠标拖外释放、Escape/源focus、中文caret鼠标及Tab/Enter插入；组合状态仅合成composition配原生键盘，不宣称OS候选窗口。0send/room/BUY，既有多端发送与UI03频道证据复用。

原 popup 动态父挂载、原点击事件 callback、默认字体与整页1:1仍未完成。

## 实际证据

`browser-lobby-emote-source-page-2026-10-04T22-22-35-867Z.json` PASS。三张完整大厅800/1920/3840 PNG已逐张查看，原全32控件/30glyph/8frame均可辨、解码成功且在viewport内。

真实鼠标按下捕获、拖出保持 capture、外部释放取消开菜单并恢复 Normal；原生 Escape 无 window 漏键、返回源 toggle。中文甲乙光标在中间，鼠标001插为甲▁乙/caret2，再 Tab/Enter002插为甲▁▂乙/caret3，两次均返回原输入焦点。合成composition状态下真实鼠标 toggle保持原输入；菜单打开且输入聚焦时 nativeEscape保持菜单/焦点，composition结束后 nativeEscape关闭。源toggle焦点在menu外时根 Escape 同样关闭且无漏键。

没有发送、建房、购买、对局或关系写；端口3424/5454/9654与临时库清理。专属 Webtypes exit0，统一生产构建待主线收取；组件/类型不替代本次页面证据。交片索引 `lobby-emote-source-page-accepted.json`，限定菜单消费者，不关闭完整大厅与聊天父项。
