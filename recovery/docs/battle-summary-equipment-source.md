# 战斗结算装备奖励提示

正式结算在真实新称号队列耗尽后，按“道具优先、耗尽后坦克”的顺序逐条显示服务器实际发放的拥有记录；每条复用原生装备对话框与 3.4 秒横移动画，全部耗尽且无后续提示时奖励层渐隐。没有实际发放记录时不显示任何虚构图标或文案。

## 原客户端依据

读取 `current-exe.asm`、原 PE、已验证布局及原表；未执行原生代码、Unicorn、浏览器、构建、类型检查或新取证脚本。

`game_summary_dialog.xml` 只有三个控件：`wndDialog` 原矩形 235,326–564,422，九宫图集 `lobby_ditu0`；`picItem` 相对 `wndDialog` 34,31–66,63，`HorzStretched`/`VertStretched`，本身没有 `Image` 属性，显示时按记录设置图片；`txtMessage` 相对 84,18–300,75，为 `RichEditbox`。消费者 `battle-summary-equipment-page.tsx` 复用 `battle-summary-title-page.tsx` 的 3.4 秒 0.2/3/0.2 横移动画、Enter/Escape 跳过、回源焦点与计时清理风格。

| 队列 | 来源 | 记录字段 | 显示身份 |
| --- | --- | --- | --- |
| 道具 | `UMsgFtGameOver +0xe0`，元素为 4 字节记录指针 | `0x4aa7b3` 读记录 `+0xc` 作 Item 表查询 | `0x4aa800` 取 Item 表名称；`[表记录+0x4c]` 作 `0x5cde08="data\\ui\\daoju\\%.5d.tga"` 图片参数，图集 `0x5cde00="daoju0"` |
| 坦克 | `UMsgFtGameOver +0xe4`，元素为 4 字节记录指针 | `0x4aa9c1` 读记录 `+0x24` 作图片编号 | 记录 `+4` 名称字符串、`+0x18` SSO容量判据；`0x5cdde8="data\\ui\\tanke\\%.3d.tga"` 图片参数，图集 `0x5cdde0="tanke0"` |

两条队列由结算状态 9 的自动推进块 `0x4ac304–0x4ac339` 消费：`0x4aa78b` 先取道具队列 `+0x3c`，还有元素时调用 `0x4aa7ab` 立即显示一条；道具耗尽后跳 `0x4aa998` 取坦克队列 `+0x50`，坦克也耗尽才返回 false，状态机推进到状态 10。状态 9 只在状态 8 的称号队列耗尽后进入，没有记录时不合成空奖励。gamestring140 精确模板为 `你获得了<colour red=255 green=0 blue=0 alpha=255>%s</colour>。`，道具与坦克分支都用同一模板，`%s` 在道具分支取 Item 表定义名称，在坦克分支取结果记录的实例名称。

UI40 声音在状态 7 的四值奖励页入口 `0x4ab3ab–0x4ab3b3` 播放一次，新增称号在 `0x4aad11` 复用 UI40。状态 9 的装备奖励显示链没有独立声音调用，本页按原调用保持无额外提示音。

## 服务端和网页接线

协议 `MsgRoomSnapshot/ResultAward` 新增 `grantedItems?: ResultItemGrant[]` 与 `grantedTanks?: ResultTankGrant[]`，为本局服务端已实际持久发放的拥有记录；`ResultItemGrant` 携带 `instanceId/itemTableId/name/iconId`，`ResultTankGrant` 携带 `instanceId/tankId/name`。UI 只读这些记录，不推算、选择或请求发放，不通过库存前后差异、胜负或奖章推导装备奖励。

`battle-summary-page.tsx` 在统一 notice 游标中先消费 `grantedTitles`，耗尽后按 `grantedItems` 再 `grantedTanks` 的队列顺序推进，只在 `sequence.stage === 'notices'` 时渲染。重复快照、分页与再战投票不重播：游标按显示身份推进，`round` 变化时 `setTitleIndex`/`setEquipmentIndex` 归零；离房卸载时对话框清理计时器、关闭并回源焦点。文本先经 `battleInfoText` 转义再插入。图标只由真实 `iconId`/`tankId` 记录供给 `daoju0`/`tanke0`，无 demo 或占位名称。

## 限制

原消息复制每个 4 字节记录指针，显示端读取记录的定义号、图号和名称，不按数量决定提示行数；发放条件尚未取得。已核对的 `item`、`tank`、`dropitem`、五份模式表和 `datascale` 只提供定义、展示属性、货币/成长倍率与地面掉落模型，未给出战斗结束时向 `+0xe0/+0xe4` 生产记录的规则。当前服务端已按 battle-equipment-exit-melee-rules.md 的采用资格、25%道具与5%坦克概率生成真实拥有记录，并与结算回执原子提交。客户端只显示成功回执；空队列自动继续。原条件/概率仍缺来源，新增真实到账和弹窗尚未实测，本条业务验收与父项 UI-21/M5-06 保持未勾。

仅完成静态源码与网页接线核对，未运行测试、浏览器、构建、类型检查或 lint。
