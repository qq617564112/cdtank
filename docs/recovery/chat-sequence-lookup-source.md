# SequenceImageManager 名称查询入口

状态：入口已定位，原名称成功/失败向量尚未执行。

`CEGUIWindowsLook.dll` IAT `0x1003dc40` 对应 `SequenceImageManager::getSingleton`；IAT `0x1003dc3c` 对应 `SequenceImageManager::getSequenceImage(const CEGUI::String&)`。

`CEGUIBase.dll` 原地址 `0x10029230` 从 `0x10197ca4` 返回 singleton；原地址 `0x10029290` 的 getSequenceImage 调用 `0x1003bf60` 进行真实 map 查询。返回节点等于 header 时进入 `0x100292cc` 失败分支；成功分支 `0x1002932e` 从节点 `+0xa4` 读取序列指针并返回。

失败分支在 `0x10029312` 调用 Exception 基类构造入口 `0x1000c730`，在 `0x10029321` 写入 `UnknownObjectException` vtable `0x1010f294`，在 `0x10029329` 调用 throw 入口 `0x100fddb0`。导出 `UnknownObjectException(const String&)` 位于 `0x10002b80`，也使用 `0x1000c730` 并写入同一 vtable。这里是静态反汇编入口证据，尚未执行失败构造或 throw。

现有 `chat-image-source.py` 已提供 CEGUIBase 重定位和真实 map 节点构造，可以复用。现有 `chat-rich-layout-source.py` 使用 Python 序列字典作为返回值 provider，不能据此证明原名称查询成功或失败。

## 剩余入口

接续工作需要将真实 singleton/getSequenceImage 接入 XML 原消费者，按原序列目录构造名称节点，执行 `001`、`030` 与非精确名称、缺 name 的最多十组向量，并记录实际 map 比较与失败分支。尚未查明 formatText、onTextChanged/setter 的异常处理；不得据空 lines 推定整条消息被丢弃。

当前没有新执行向量、PASS 结论或 provider 阻塞报告。
