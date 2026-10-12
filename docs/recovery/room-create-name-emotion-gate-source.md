# 建房EmotionFont资格

原CEGUIBase Editbox字段+0x3e4为EmotionFont指针，普通Font由Window读取，两个字段各自消费。原构造器 `0x1005812d..0x10058139` 清EmotionFont0，原EXE建房初始化 `0x4a257f..0x4a262e` 查找房名/密码并设置普通Font+0x104、长度8/20及密码masked=true，限定初始化保持EmotionFont0。源createroom.xml的房名/密码没有EmotionFont属性。

`room-create-name-emotion-gate-native.json` 记录实际原字段写入与初始化call路径；XML-loaded窗口持有构造器默认值、普通字体与CEGUI String/getWindow/相关setter效果为明确provider。`0x1000a9a9` 检测EmotionFont，`0x1000a9b1` 零分支跳 `0x1000aef6` 普通前缀绘制。因此完整WLEditbox draw在源font0下绘prefix/selected/suffix，房名包括U2501..U251E普通输入，密码为完整星号串。

完整6房名与4密码向量分别见 `room-create-name-selection-native.json` / `room-create-password-selection-native.json`；显式非零EmotionFont另行执行特殊prefix路径，不作为实际建房状态。当前正式消费和度量provider见 `room-create-name-selection-source.md`、`room-create-password-selection-source.md`，玩家验收见 `room-create-name-emotion-gate-browser.md`。

## 限制

完整layout loader/virtual hook及任意后续字体赋值未执行；限定setup保存0不是全程序无赋值结论。非零EmotionFont glyph、原OS字体/GPU和精确scroll保持父项。原8/20输入资格由INPUT-LIMIT单独恢复，见room-create-input-limit-source/browser.md。
