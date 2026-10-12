# 设置页战斗表情选项来源（UI-50 / M5-14）

`settings.xml` 的 `WindowsLook/Checkbox` `zhandoubiaoqing` 位于 `youshangditu`(385,139,739,254) 内，AbsoluteRect(24,73,114,94) 90×21，Normal/Hover 均引用 `waijiemian0` 的 `data\ui\waijiemian\zhandoubiaoqing2.tga`，CheckMark 引用 `zhandoubiaoqing1.tga`，无 PushedImage、DisabledImage 空串；导出区 74/84.png 与 74/85.png，图面文字为“战斗表情”。原 EXE 在设置页构造时以 `Settings/zhandoubiaoqing` 取窗口存入设置页对象 `+0x2c`，随即以 `0` 调 `Window::setEnabled`（`0x5102d9–0x510311`），即原客户端把该复选框置为禁用；本页范围内未见后续 enable。

独立配置事实：`Config\SystemSetting.ini` 的 `[Display]` 字段 `ShowBattleEmotion`（字段名 0x5c259c，节名 Display 0x5c25ec），对应进程级配置设置对象单例 0x6335b8 的 `+0x230`。加载路径 `0x41d2a2–0x41d2dd` 以默认值 `1` 从 INI 读入并写入 `[esi+0x230]`；保存路径 `0x41ccba–0x41cd46` 把 `[esi+0x230]` 当前值作为参数写出到同节同字段。工作副本 INI 无该行，故实际取加载默认 `1`。该配置设置对象不是设置页 UI 自身；上下文无“该字段值→复选框 setSelected”的直接指令，不能声称复选框已确证读取该配置，更不能由默认 `1` 推断 Web 需勾选。

`ShowBattleEmotion` 的运行时消费者及其被控对象未证明。宠物头像战斗表情、角色上方表情、聊天表情三条候选均无来源支撑，不接任一消费者，不新开免费业务。现 Web 消费者 `settings-source-view.tsx` 的 `UNSUPPORTED_OPTIONS` 以共享 `SettingsSourceButton` 按原矩形/原图禁用呈现该控件，与该有限原事实一致。本页为静态读取来源，非原执行或实测证据；原条件 enable、checkbox 选中映射与真实页面高清表现保持未验。原 writer/consumer 缺失只影响该字段的语义接线，不阻塞本控件按原禁用态完成界面保真。
