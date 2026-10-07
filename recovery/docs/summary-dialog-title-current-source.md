# 结算称号与装备提示来源现态

本文恢复 UI-21 `game_summary_dialog.xml` 与 UI-22 `game_summary_title.xml` 的原始布局、动态记录字段及当前正式消费链。UI-39 `myhome_playerpage_titlesummary.xml` 只作称号文档交叉引用；本文不重复称号 domain、装备 reward、结算 sequence、成长、奖项或声音实现。

## 原客户端依据

结算状态 8 由 `0x4ab40e` 判断，调用 `0x4aaba3` 显示一条称号，再进入状态 9。状态 9 由 `0x4ab422` 判断并调用 `0x4aa78b`：先消费 `+0x3c` 的道具队列，再消费 `+0x50` 的坦克队列；两队都空后返回 false，状态机进入状态 10。状态 10 的 `0x4ac274–0x4ac2b7` 在 1 秒内把整页 alpha 从 1 降到 0。没有记录时不合成空提示。

### UI-21 三控件

| 控件 | 类型 | AbsoluteRect | RelativeRect | 源资源 |
| --- | --- | --- | --- | --- |
| `wndDialog` | `WindowsLook/StaticImage` | `l:235 t:326 r:564 b:422` | `l:0.293750 t:0.544240 r:0.705000 b:0.704507` | `lobby_ditu0` 的 `tanchukuang1..9.tga` |
| `picItem` | `WindowsLook/StaticImage` | `l:34 t:31 r:66 b:63` | `l:0.103343 t:0.322917 r:0.200608 b:0.656250` | 无 `Image`，运行时按记录设置图片；`HorzStretched`/`VertStretched`；框图为空 |
| `txtMessage` | `WindowsLook/RichEditbox` | `l:84 t:18 r:300 b:75` | `l:0.255319 t:0.187500 r:0.911854 b:0.781250` | 无背景/边框；`NormalTextColour=FFFFFFFF` |

`wndDialog` 的九宫图为：中心 `tanchukuang9.tga`，左上/右上/左下/右下分别 `tanchukuang1/2/3/4.tga`，上/下/左/右分别 `tanchukuang8/7/5/6.tga`，全部属于 `lobby_ditu0`。`picItem` 与 `txtMessage` 当前位于 `wndDialog` 下，XML 坐标相对父窗口；当前 Web 的 `HomeSourceLayout`/`sourceProps` 按父链累加左右上坐标。

状态 9 的动态记录字段：

| 队列 | 队列来源 | 原显示读取 |
| --- | --- | --- |
| 道具 | `+0x3c`，元素为 4 字节记录指针 | `0x4aa7b3` 读记录 `+0xc` 查询 Item 表，名称取表记录名；`[表记录+0x4c]` 作为 `daoju0` 的 `data\ui\daoju\%.5d.tga` 图片参数 |
| 坦克 | `+0x50`，元素为 4 字节记录指针 | `0x4aa9c1` 读记录 `+0x24` 作为 `tanke0` 的 `data\ui\tanke\%.3d.tga` 图片参数；名称取结果记录 `+4`，`+0x18` 为名称字符串 SSO 判据 |

道具与坦克共用 gamestring140：

```text
你获得了<colour red=255 green=0 blue=0 alpha=255>%s</colour>。
```

道具分支的 `%s` 是 Item 表定义名称，坦克分支的 `%s` 是结果记录实例名称。`txtMessage` 只承担同一富文本控件的动态正文，不增加 XML 控件。

### UI-22 两控件

| 控件 | 类型 | AbsoluteRect | RelativeRect | 源资源 |
| --- | --- | --- | --- | --- |
| `wndDialog` | `WindowsLook/StaticImage` | `l:235 t:326 r:564 b:422` | `l:0.293750 t:0.544240 r:0.705000 b:0.704507` | `lobby_ditu0` 的 `tanchukuang1..9.tga`；`ClippedByParent=False` |
| `txtMessage` | `WindowsLook/RichEditbox` | `l:55 t:38 r:278 b:78` | `l:0.167173 t:0.395833 r:0.844985 b:0.812500` | 无背景/边框；`NormalTextColour=FFFFFFFF` |

`game_summary_title.xml` 没有关闭按钮。原状态 8 由 `0x4aaba3` 消费称号队列 `+0x54`，取得称号名称后写入 `txtMessage` 所用显示链；该函数引用 gamestring ID `0x295` 并把名称格式化到正文。当前恢复范围未取得 `0x295` 的完整原始字符串，当前 Web 正文采用页面现用模板，不把未解码文本写成原表事实。

## 当前消费链

正式入口是 `BattleSummaryPage`。它从本人正式冻结结果记录取 `own.award`，再由 `ResultAward.grantedTitles`、`grantedItems`、`grantedTanks` 构造提示队列：

```text
confirmed ResultPlayer.award
  -> useSummarySequence(...).stage === "notices"
  -> grantedTitles 逐条
  -> grantedItems 逐条
  -> grantedTanks 逐条
  -> 奖励层 1 秒渐隐
  -> stage "done"
```

顺序与优先级固定为称号在前；称号未耗尽时，`currentEquipment` 保持空。道具和坦克合并为一个 `EquipmentGrant[]`，道具全部先于坦克。`round` 变化时 `titleIndex`、`equipmentIndex` 归零；重复快照、分页与再战投票不重播已消费记录。

称号 producer 已沿账户结算事务写入持久授予记录，并由 `World.attachResultAwards`/回执投影到 `ResultAward.grantedTitles`。装备 producer 已在账户结算事务中对真实拥有记录做原子提交，回执提供 `ResultItemGrant` 或 `ResultTankGrant`。原装备发放资格/概率仍缺来源；当前采用条件与概率见 `battle-equipment-exit-melee-rules.md`，不属于本页动态字段恢复。

### 称号 child consumer

`BattleSummaryTitlePage` 使用 `game_summary_title.xml`：

- `wndDialog` 由 `SourceStaticImage` 按源九宫图画框。
- `txtMessage` 由 `sourceProps` 取得源矩形，正文经 `HudBattleInfoView` 显示 `PlayerTitle.name`。
- 开启时 `dialog.show()`、`dialog.focus()`，并设置 3400ms 自动关闭计时器。
- 当前 Web 采用的回退交互为 Enter/Escape 或 dialog cancel：关闭当前一条，`titleIndex` 加一。
- 卸载时清理计时器、`dialog.close()`，并通过 `origin()` 返回 `[data-summary-continue]` 的 `btnClose`。若该节点仍在文档内则恢复焦点。

### 装备 child consumer

`BattleSummaryEquipmentPage` 使用 `game_summary_dialog.xml`：

- `wndDialog` 由 `SourceStaticImage` 按源九宫图画框。
- `picItem` 的 `reference` 由 `EquipmentGrant` 决定：道具取 `grant.item.iconId` 并补足 5 位，进入 `daoju0/data\ui\daoju\`；坦克取 `grant.tank.tankId` 并补足 3 位，进入 `tanke0/data\ui\tanke\`。
- `txtMessage` 由 `sourceProps` 取得源矩形，正文经 `HudBattleInfoView` 显示 `grant.item.name` 或 `grant.tank.name`，并使用 gamestring140 的富文本模板；名称先经 `battleInfoText`。
- 开启、3400ms 自动关闭、Enter/Escape 或 dialog cancel、卸载关闭与焦点回退和称号页一致；关闭当前一条只推进 `equipmentIndex`。

两页都以已计算好的 800×600 源页面 `scale` 叠加 `SourceImageScale` 和 stage zoom。`SourceStaticImage` 保留原图的中心图、九宫图框与 atlas 尺寸；`txtMessage` 保留 XML 矩形和白色正文。当前实现没有独立关闭按钮、点击命中面或新 API；未知原 callback 名称不推测。

## UI-21/UI-22 登记现态

UI-21 的三个源控件已经全部进入正式装备提示：名称 `wndDialog/picItem/txtMessage`、原几何与帧图均有当前 consumer，真实 `grantedItems/grantedTanks` 在 confirmed result 后按队列渲染。

UI-22 的两个源控件已经全部进入正式称号提示：名称 `wndDialog/txtMessage`、原几何与帧图均有当前 consumer，真实 `grantedTitles` 在 confirmed result 后按队列渲染。

因此，tasklist 中 UI-21/UI-22 的裸验收行不表示尚未接线；它们仍未完成的只是该行要求的实际页面业务验收。当前范围内没有“正常 result 字段已产出但缺 child consumer”的缺口。

## UI-39 交叉引用

`myhome_playerpage_titlesummary.xml` 只有三控件：

| 控件 | 类型 | AbsoluteRect | 源资源 |
| --- | --- | --- | --- |
| `SheetWindow` | `WindowsLook/StaticImage` | `l:0 t:199 r:375 b:331` | `mycabin00/data\ui\mycabin0\ditu6.tga`，横纵拉伸 |
| `bg` | `WindowsLook/StaticImage` | `l:4 t:2 r:371 b:125` | `gy0/data\ui\gy\huangtiao1.tga` |
| `lstTitles` | `WindowsLook/Listbox` | `l:1 t:2 r:365 b:122` | `SelectionImage=lobby_ditu0/xuanzhong2.tga`，滚动条取 `gy0` 原图 |

`title-client-presentation.md` 采用该页 `lstTitles` 几何显示账户权威 `owned` 称号，并沿 `RoleProfile.titles` 查询/佩戴，不造默认称号，也不新增重复 API。本文只保留这层交叉引用；Home 侧实际 consumer 文件不在本次 owned/只读依赖内，若 tasklist 要登记 UI-39 的当前实现文件，需要 root 提供该文件路径。

## Known Issues

- 原称号 gamestring `0x295` 的完整文本未在本来源范围解码；当前 Web 模板只作为现行显示采用登记。
- 原称号结果记录除队列 `+0x54` 与显示名称 lookup 外的字段结构尚未恢复，不作猜测。
- 原 XML 没有关闭控件；3400ms、Enter/Escape、dialog cancel 与焦点回退是当前 Web 采用，不等同于已恢复的原 callback 名。
- 装备发放资格和概率仍缺原来源；当前正常回执只消费服务器已实际发放的记录。
- 800×600 源几何、资源名和消费者链已登记；原高清/font/alpha/GPU 与三分辨率实际验收边界不变，本文不产生新的实测结论。
- UI-39 只作 XML 与称号文档交叉引用；Home 实际 consumer 文件未纳入本次只读范围。
