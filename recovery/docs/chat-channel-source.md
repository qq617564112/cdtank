# 聊天频道来源与业务边界

后续限定恢复已确认战斗原公共1/队伍5、选择与发送入口，见chat-channel-selection-source.md。本文记录先前布局/上限取证的范围；下述“未恢复数值/回调”现以该后续来源限定更新，不代表原完整文字线格式或服务器路由已恢复。

原普通房间输入和战斗输入都调用 `CEGUI::Editbox::setMaxTextLength(72)`。原布局证明公共、队伍、好友、密语和 GM 的入口及显示控件；本次限定来源核对未证明它们的网络频道数值，也未证明完整的发送/接收回调。重建同房聊天可以完成身份、发送确认、双端显示与阶段连续性业务，频道 `0` 仍是重建合同。

## 原控件

以下行号均指 `recovery/output/verified/assets/data/Data/ui/layouts/` 下解包的原 XML，`AbsoluteRect` 为父内矩形。完整58控件清单见 `recovery/output/chat-channel-source.json`。

| 原文件与行号 | 控件 | 已证明用途 |
| --- | --- | --- |
| chat.xml:58 | ChatTextBox，RichEditbox，11,11–585,125 | 原房间聊天显示区 |
| chat.xml:176 | edtNormalUserInput，Editbox，14,4–518,21 | 普通内容输入 |
| chat.xml:254 / 270 | edtIntimateNameInput / edtIntimateChatInput | 密语对象昵称与内容分别输入 |
| chat.xml:94–149 | btnPrivateChannel / btnPublicChannel / btnFamilyChannel / btnFriendChannel / btnGMChannel / btnTeamChannel | 六个频道入口按钮 |
| chat.xml:47 / 287 | btnExpandEmotion / btnExpandIntimate | 表情与密语对象展开入口 |
| chat_channellist.xml:30 / 42 / 54 / 66 / 78 | rdoPublic / rdoPrivate / rdoFriend / rdoTeam / rdoGM | 房间五个频道选择项 |
| chat_channellist_lobby.xml:30 / 42 / 54 / 66 | rdoPublic / rdoPrivate / rdoFriend / rdoGM | 大厅四个频道选择项 |
| game_main_chat_shrinked.xml:31 | edtDisplayBox，RichEditbox，7,7–293,101 | 战斗聊天显示区 |
| game_main_chat_shrinked.xml:109 | edtChat，Editbox，8,4–225,22 | 战斗普通内容输入 |
| game_main_chat_shrinked.xml:207 / 223 | edtIntimateNameInput / edtIntimateChatInput | 战斗密语对象与内容输入 |
| game_main_chat_shrinked.xml:137–181 / 251 | btnPublic / btnFriend / btnFamily / btnPrivate / btnGM / btnTeam | 战斗频道入口按钮 |
| game_main_channellist.xml:31 / 43 / 55 / 67 / 79 | rdoPublic / rdoPrivate / rdoFriend / rdoTeam / rdoGM | 战斗五个频道选择项 |

原 `gamestring.csv` 的 ID13（行14）说明密语未填写对象不能发送；ID332/338/339/340/341（行333/339/340/341/342）分别是选择频道、选择密语对象、输入对象昵称、输入内容、插入表情的提示。这些数字是游戏字符串 ID，不是聊天频道 ID。`lobbylist.csv` 的新手/高手等频道名称是服务器大厅目录，也不能推导聊天消息的频道数值。上述 XML 没有为频道选择项定义数值 `ID`，也没有独立发送按钮。

## 原生输入长度

原文件为只读 `CDTank/CDTank.exe`，PE ImageBase `0x400000`。以下都是虚拟地址：

| 范围 | 控件字符串 | 初始化与限制 |
| --- | --- | --- |
| 房间 | `ChatPanel/edtNormalUserInput`，`0x5cbe40` | `0x49a5b4` 推入控件名；`0x49a5dd` 保存到 `this+0x8c`；`0x49a5f5` 推入 `0x48`，`0x49a5f7` 调用 `[0x5c0268]` |
| 战斗 | `GameMainShrinkedChat/edtChat`，`0x5d0128` | `0x4c9956` 推入控件名；`0x4c997e` 保存到 `this+0xac`；`0x4c9999` 推入 `0x48`，`0x4c999b` 调用 `[0x5c0268]` |

IAT `0x5c0268` 对应 `CEGUIBase.dll` 导入 `?setMaxTextLength@Editbox@CEGUI@@QAEXI@Z`，因此 `0x48` 是原输入的最大文本长度72，不能解释为频道数。脚本只读取这两段初始化，不替代原窗口或模拟服务器。

重现命令：

```sh
recovery/.venv/bin/python recovery/evidence/chat/chat-channel-source.py
```

输出 `58 controls; room/battle maxTextLength=72`，并写入 `recovery/output/chat-channel-source.json`，其中保留源控件行号、矩形、导入名与两段逐指令反汇编。断言检测原 setter 地址或常量变化；出现变化时应重新核对长度来源，不能沿用72。

## 本片业务闭环

使用当前连接确认玩家身份与所属房间，以服务端确认的玩家名显示消息；房间等待、战斗、结算共用同房广播。客户端发送后保留输入直至收到业务确认，失败保留文字；断线、离房与换房清理旧回调和旧日志。双端验收应覆盖同房接收、异房隔离、长度拒绝、发送拒绝及阶段转换。原普通输入上限72可以落实到当前客户端与服务端，作为有来源的长度参数。

## 未证明边界

原房间与战斗各频道的网络数值、公共频道具体广播范围、队伍/好友/家族/GM/密语路由、Enter 发送的原回调、发送成功或失败回包、历史容量和过滤规则均未恢复。本次不存在已证明完整的原聊天发送/接收回调。原 CEGUI Unicode 长度与 HTML `maxLength` / JavaScript UTF-16码元在补充平面字符上的等价性也未证明。当前72码元规则和业务回执属于重建实现；完整原频道与窗口仍需各自业务验收，不能由同房聊天通过推定完成。
