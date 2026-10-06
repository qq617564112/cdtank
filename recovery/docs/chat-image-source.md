# 聊天 image 标签原执行

普通聊天输入可使用 `<image set=gy0 name=data\ui\gy\lt1.tga/>`。共40个字符，在原72字符上限内。属性名是 `set` 与 `name`；原图为 `gy0` 的 `data\ui\gy\lt1.tga`，20×20像素，已导出的DDS优先目录对应 `ui/regions/60/187.png`。

`recovery/.venv/bin/python recovery/evidence/chat/chat-image-source.py`：PASS，11组向量。输出 `recovery/output/chat-image-source.json` 与 `recovery/output/chat-image-source.disasm.txt`。

## 原消费、布局及绘制

原 `formatText 0x10027370` → TinyXML `0x10003bd0` → 树遍历 `0x10027100` → 元素分支 `0x100268bd` → `0x10026a5a` 的 IAT `0x1003d160` → `ImagesetManager::getSingleton` → `getImageset` → `Imageset::getImage` 实际执行。CEGUIBase.dll 与 WindowsLook.dll 原preferred base相同，因此Base重定位到 `0x30000000`；Singleton/GetImageset/GetImage分别执行 `0x3001a650/0x3001a6c0/0x30018f80`。两次目录查询的原map lower_bound/find代码也执行，只在CEGUI String比较值边界提供字符串排序。

目录节点与Image尺寸来自已验证ui.json的gy0 DDS目录。原manager/lookup没有替换为Python字典查询。font、String、XMLAttributes及最终图形draw调用沿用值供应边界；PNG不是本脚本绘制的Windows framebuffer。

image项类型为2，Image指针保存在item+8，宽高由原Image+0x20/+0x24取出。默认颜色四通道均1，绘制四角ARGB均 `0xffffffff`。标签中的width、height、red、green、blue、alpha不被消费；外层colour也不改变image项颜色。

原image按整项宽度换行，画完整20×20图片。默认draw矩形 `[20,10,40,30]`；`A<image .../>B`中图片矩形 `[27,10,47,30]`，B从47起。图宽不减1、左边不加1，这与emote的原绘制不同。区域宽28时，`AB<image .../>C`产生宽14与27两行，第二行图片为 `[20,26,40,46]`。图高20不改变字体行距16。

## 缺失资源与执行边界

缺set、错误属性imageset或未知set进入原getImageset失败分支 `0x3001a6fc`；缺name或未知name进入原getImage失败分支 `0x30018fca`。失败分支构造 `CEGUI::UnknownObjectException`，没有“跳过该标签后继续B”的处理。输出以错误种类、请求名和原失败分支记录该contract。

脚本在原异常构造开始处停止，未执行Windows/MSVC异常抛出和跨调用者展开；因此不把该停止后的空lines解释为客户端整条消息丢弃策略。调用者捕获与后续UI恢复属于该异常边界之外。
