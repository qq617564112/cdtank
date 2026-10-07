# 收到聊天 emote/image 名称查询：来源事实与当前 Web 采用

状态：精确名称采用生产接线已完成；原 manager 名称向量及异常外层、新受影响实测待完成。来源事实取自既有 disasm/source，不新增原执行向量。

## 结论

- 原 `SequenceImageManager::getSequenceImage(name)` 以精确字符串为键，键为 `001`–`030`。命中从节点 `+0xa4` 取原序列指针；未命中构造并抛出 `UnknownObjectException`。
- 当前 Web emote producer → parser 已按原精确名称采用：只有 `name` 严格等于 id 的 `001`–`030` 三位 canonical 名称才进入序列/布局/动画/清理链；缺 name 和未知/近似名一起走既有 `unsupported-source` 字面回退。
- 当前 Web image consumer 保持精确同名查找：`ChatImageCatalog.image(set,name)` 对 imageset 名与 image 名做 Map 精确 get。成功资源业务保持已交付，缺资源显示保持父门禁。
- 原异常跨 `formatText`/`onTextChanged`/setter 的外层显示未取得，Web 采用 `unsupported-source` 字面回退不作为原行为声明。

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
- emote 名称→序列：`chatSourceMarkup()` 对内部表情码点展开固定三位 `<emote name=001 …/>`；`parseChatSourceMarkup` emote 分支确认 `Number(name)` 为整数、落在 `1`–`EMOTE_COUNT`，且 `name` 严格等于 `String(id).padStart(3,'0')`，再按 id 交给 `chat-emotes.ts` 的 `this.sequences?.get(item.emoteId)`；序列目录 `chat-emote-sequences.json` 由 `loadChatEmoteSequences` 按 id 建 map。
- image 名称→资源：`parseChatSourceMarkup` image 分支 `resolveImage(set,name)` → `ChatImageCatalog.image` → 对 set Name / image Name 精确 Map get。
- layout：`chat-rich-text.ts` `layoutChatRichText`；animation：`chat-emote-animation.ts` `ChatEmoteSequence` 与 `chat-emotes.ts` `tick/paint`；cleanup：`ChatEmotes.clear/remove` 与 `loadChatEmoteSequences` 缓存。

### 精确性

- image：精确同名，已对齐原 getImageset/getImage 精确键。
- emote：精确名称。`name=001`–`030` 正确；`1`/`01`/`1.0`/`0x1`/`1e0`/含空白数字不再等价命中，缺 name/未知/近似名一起在 Web 记为 `unsupported-source`，整条字面回退（现有 Web 政策）；原精确查找的异常显示未被采用。
- `invalidsyntax` 既有空 items / flags 语义保持；合法 glyph、typed token、`001`–`030` provider、颜色、layout、identity/rawtext、字体与资源 owner cleanup 行为保持。

## 采用后的完整正常场景

peer 在正常收到文本中发送字面 `A<emote name=01/>B`（或 `name=1`/`name=1.0`/`name=0x1`/`name=1e0`）：

- 原：name 非 `001`–`030` 精确键 → getSequenceImage 未命中 → 构造抛 `UnknownObjectException`（跨调用者显示未取得）。
- 当前 Web：已采用精确名称比对，不命中 → `unsupported-source` 字面回退，不渲染 001 序列。

精确 `001`–`030` 的双端渲染/动画/清理保持已交付，不重做；image 精确同名已交付。

## Known Issues

- 本批集中静态走查已完成；原 SequenceImageManager 运行向量、原异常外层及本接线受影响双端/高清实测仍待完成。
- 原 `UnknownObjectException` 在 `formatText`/`onTextChanged`/setter 之后的显示未取得；Web 保持既有 `unsupported-source` 字面回退，不冒充原行为。
- 原 SequenceImageManager 精确名称成功/失败执行向量未取得。
- 精确名称采用后的原名称/parser 对照、受影响双端消息、动画与高清验收未实测。
- server 原来源缺时按客户端发送/接收规则推采用；本范围客户端异常显示来源亦缺，不作原恢复声明。
- 原消息 authority/identity/rawtext、已接颜色与 geometry、用户字体不改；未取得 source/实测/HD 项保持未完成。
