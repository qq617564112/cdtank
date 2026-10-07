# 收到聊天 emote/image 名称查询：来源事实与当前 Web 采用

状态：原 emote 精确名称的成功/失败执行向量未取得；来源事实取自既有 disasm/source，不新增原执行向量。

## 结论

- 原 `SequenceImageManager::getSequenceImage(name)` 以精确字符串为键，键为 `001`–`030`。命中从节点 `+0xa4` 取原序列指针；未命中构造并抛出 `UnknownObjectException`。缺键在 `formatText`/`onTextChanged`/setter 之后的显示无直接来源。
- 当前 Web emote consumer 未做精确同名查找：`parseChatSourceMarkup` 用 `Number(name)` 转整数后按 id 取序列，接受 `1`/`01`/`1.0`/`0x1`/`1e0`/含空白等数字等价别名，与原精确键不符。该行为可经正常收到文本/标签到达，是真实未接线缺口。
- 当前 Web image consumer 已做精确同名查找：`ChatImageCatalog.image(set,name)` 对 imageset 名与 image 名做 Map 精确 get。缺资源回退为现有 Web 字面策略，原异常跨调用者显示保持未取得。
- E-X-U 仍有真实 production 缺口（emote 精确名称）；E-X-I 成功资源业务保持已交付、缺资源显示保持父门禁，均不虚构原异常显示。

## 原来源事实

### 产生到消费

- 收到字节 → `0x412649` 转 CEGUI 字符 → `0x41242a` 展开内部表情码点：每个表情码点精确输出 `<emote name=001 red=255 green=255 blue=255 alpha=255/>`，普通字符（含 `<`、`>`）逐字符保留、不转义。
- 结果串 → `WLRichEditbox::onTextChanged 0x10027980` → `formatText 0x10027370` → 内嵌 TinyXML `0x10003bd0` → 树遍历 `0x10027100` → elementStart `0x100261a0` emote 分支 `0x100263db–0x10026862` 读取 `name` 与颜色属性。
- 在 `0x100266cd` 调用 `SequenceImageManager::getSequenceImage(name)`。

### 名称查询与失败

- `CEGUIWindowsLook.dll` IAT `0x1003dc3c` 为 `getSequenceImage(const CEGUI::String&)`；`0x1003dc40` 为 `getSingleton`。
- `CEGUIBase.dll` `0x10029290` getSequenceImage 调 `0x1003bf60` 做 map 查询。
- 命中分支 `0x1002932e`：从节点 `+0xa4` 读原序列指针返回。
- 未命中分支 `0x10029312`：调用 Exception 基类构造入口 `0x1000c730`，`0x10029321` 写 `UnknownObjectException` vtable `0x1010f294`，`0x10029329` 调 throw 入口 `0x100fddb0`；导出 ctor `0x10002b80`。
- 名称键为精确字符串 `001`–`030`（`recovery/output/web-assets/chat-emote-sequences.json`，对应原 `.seqimage` 逐文件 Name）。正常 glyph 展开固定三位补零，正常玩家只产生精确 `001`–`030`；peer 直接发送字面 `<emote name=.../>` 时 name 不受此约束。

### 未取得

- 缺键异常在 `formatText`/`onTextChanged`/setter 之后的显示未取得；不据静态证据断定整条丢弃或崩溃。
- 原 manager 实际成功/失败名称向量未执行。

## 当前 Web 采用

### 路径

- producer/parser：`chatSourceMarkup()`（glyph 展开）→ `parseChatSourceMarkup()`（内嵌 TinyXML 等价解析）。
- emote 名称→序列：`parseChatSourceMarkup` emote 分支 `Number(node.attributes.name)` → 整数 → `chat-emotes.ts` `this.sequences?.get(item.emoteId)`；序列目录 `chat-emote-sequences.json` 由 `loadChatEmoteSequences` 按 id 建 map，name 仅做 `001`–`030` 校验。
- image 名称→资源：`parseChatSourceMarkup` image 分支 `resolveImage(set,name)` → `ChatImageCatalog.image` → 对 set Name / image Name 精确 Map get。
- layout：`chat-rich-text.ts` `layoutChatRichText`；animation：`chat-emote-animation.ts` `ChatEmoteSequence` 与 `chat-emotes.ts` `tick/paint`；cleanup：`ChatEmotes.clear/remove` 与 `loadChatEmoteSequences` 缓存。

### 精确性

- image：精确同名，已对齐原 getImageset/getImage 精确键。
- emote：非精确。`name=001` 正确；`name=1`/`01`/`1.0`/`0x1`/`1e0`/含空白 被 `Number()` 归一到 1，Web 渲染 001，而原精确键 `001`–`030` 不会命中。
- 缺 name 或超范围（如 `999`）在 Web 记为 `unsupported-source`，整条字面回退（现有 Web 政策）；原精确查找的异常显示未被采用。

## 尚未接线的完整正常场景

peer 在正常收到文本中发送字面 `A<emote name=01/>B`（或 `name=1`/`name=1.0`/`name=0x1`/`name=1e0`）：

- 原：name 非 `001`–`030` 精确键 → getSequenceImage 未命中 → 构造抛 `UnknownObjectException`（跨调用者显示未取得）。
- 当前 Web：`Number('01')=1` → 渲染 001 序列。

精确 `001`–`030` 的双端渲染/动画/清理保持已交付，不重做；image 精确同名已交付。

## 下批 owned/deps

- owned：`apps/web/src/interface/battle/chat-source-markup.ts`（emote 分支改为对已恢复精确名称集合比对，`001`–`030` 之外不作数字等价回退）；必要时 `apps/web/src/interface/battle/chat-emotes.ts`（传入精确 name→sequence 解析）、`apps/web/src/interface/battle/chat-emote-animation.ts`（按 name 暴露序列）。
- deps（只读）：`recovery/docs/chat-sequence-lookup-source.md`、`recovery/docs/chat-emote-render-source.md`、`recovery/output/chat-emote-render-source.json`、`recovery/output/web-assets/chat-emote-sequences.json`。
- 不改：`chat-image-catalog.ts`（已精确）、`chat-rich-text.ts` layout、`chat-emote-colour.ts`、`source-ui-*`，以及消息身份/rawtext/用户字体。
- 不造 cache/error framework/wrapper/generic 执行器；不新增语法。

## Known Issues

- 原 `UnknownObjectException` 在 `formatText`/`onTextChanged`/setter 之后的显示未取得；Web 保持既有 `unsupported-source` 字面回退，不冒充原行为。
- 原 SequenceImageManager 精确名称成功/失败执行向量未取得。
- server 原来源缺时按客户端发送/接收规则推采用；本范围客户端异常显示来源亦缺，不作原恢复声明。
- 原消息 authority/identity/rawtext、已接颜色与 geometry、用户字体不改；未取得 source/实测/HD 项保持未完成。
