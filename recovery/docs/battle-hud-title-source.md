# 战斗HUD称号与VIP徽章的原始来源

M5-04 / UI-09。本文定位 `game_main.xml` 的 `txtPlayerTitleN` 与 `picVIPN` 的原始数据来源，
区分已确认原字段与尚未恢复的 producer。仅只读现有 EXE 字节、`recovery/output/current-exe.asm`、
已发布表文件与既有来源文档；不运行 exporter、native 或证据脚本，本文不构成实测验收。
控件逐行映射见 [game-main-control-map.md](game-main-control-map.md)。

## txtPlayerTitleN：原字段已确认，业务 producer 未恢复

消费链在正式 HUD 与房间面板各有一份，结构一致：

- HUD 槽初始化 `0x4d0769–0x4d0800`：对每个槽 `mov eax,[player]; push 0x1e; call [eax+0x18]`
  取得一个整数称号索引。索引为 0 时写空 CEGUI 字符串（常量 `0x5c0dd5`）；非 0 时到称号表
  查记录并把字符串写入 `txtPlayerTitleN`（`0x4c9128` 绑定到 controller `+0x598+4*N`）。
- 房间面板初始化 `0x50dff6–0x50e096`：同样的 `[eax+0x18](0x1e)`，写入 `RoomPanel/txtPlayerTitleN`
  （controller `+0x18c+4*N`，绑定 `0x50b43f`）。
- 查表：`0x413ca7` 返回 `globalGame(0x633588)+0x114+0xa4`，即称号表管理器；`+0xc` 为表本体；
  `0x411068` 按索引查记录；记录字符串为 SSO（`+0x14`，长度 `+0x28`，阈值 0x10）或堆指针
  （`+0x24`）；`0x412649` 转成 CEGUI 字符后 `[0x5c0240]` 写控件。

字段身份已确认为角色属性 `m_iNowTitle`，与选择子 `0x1e` 对应：

- 属性注册 `0x52220d` 把名字 `0x5d85a0`（`m_iNowTitle`）注册到角色 DB 偏移 `+0x14`；
  同区块 `0x5221e5` 注册 `0x5d85ac`（`m_iLV`）到 `+0x10`、`0x5221bd` 注册 `m_iId` 到 `+0xc`。
- 写入口 `0x4325cb`：`sub ecx,0x1e; je …` 后 `0x432641` 执行 `mov [eax+0x14],ecx`，即把
  选择子 `0x1e` 的值写入角色 DB `+0x14`。
- getter 路径即 `player vtable+0x18(0x1e)`，与两处 HUD 消费者一致。

称号表文件 `table/title.dat` 存在（loose，348216 字节，`CDTank/Data/table/title.dat`），并在
`recovery/output/catalog/inventory.json` 中登记（key `table/title.dat`，selected loose）。表加载器
`SYCommonData` 按名字注册：`0x41c24c` 以名字 `0x5c2468`="Title" 注册到管理器 `+0xa4`（正是
`0x413ca7` 返回的称号表），`0x41c1da` 以 `0x5c2470`="Level" 注册到 `+0xa8`，`0x41c16c` 以
`0x5c2478`="WordString" 注册到全局 `0x634f08`；`0x41a2ff` 为按名查找/装载入口。表头为
`CF_Flag_001` 家族格式。

### 来源缺口

缺失的是开局/对局时把 `m_iNowTitle` 写入角色记录的业务 producer：即“哪个账号持有/选用哪个
称号索引”。现有368字节 `RoleProfilePayload` 读取器没有已确认可接入该角色属性的字段；`PtlRoleProfile` 的 score/originality/tech 和两字符串也不能代替称号索引。角色 DB+0x14 不等于该 profile+0x14，见 `display-name-server.md`、`engineering-profile-boundary.md`。当前Web已提供重建的 `PlayerSnapshot.title`（选用称号ID/名称），HUD和世界标签消费其name；它与原Odl索引的完整服务端生产对应仍按原来源边界记录。因此：

- `txtPlayerTitleN` 对有玩家的槽默认显示称号表ID1“嗷嗷待哺”；真实 `HudPlayer.title` 有值时优先显示，空玩家槽保持空白。该默认文字为界面呈现策略，不写入账户持有/选用状态。
- 不以 score、kills、isVIP 或积分阶梯冒充称号。

### 若后续取得账号称号资料的最小合同（无需猜值）

要真实投影，需要普通服务端确认快照携带该账号的角色属性 `m_iNowTitle` 整数索引（选择子
`0x1e`，角色记录偏移 `DB+0x14`），再由 Web 以 `table/title.dat` 按该索引取记录字符串：

- 表为 `SYCommonData` 家族格式，头 `CF_Flag_001`；记录字符串位置与 `0x411068` 消费者一致
  （SSO `+0x14` / 堆 `+0x24`，长度 `+0x28`）。索引 0 → 空。
- Web 侧最小接入：`HudPlayer.title?: string` 仅在拿到该确认字符串时赋值；`BattleHudView`
  在 `txtPlayerTitleN` 显示；缺值时采用默认“嗷嗷待哺”，标记 `data-source-title-binding="default-title-1"`，真实值标记 `confirmed-title`。

已有 `recovery/output/verified/tables/title.json` 保留解码后的称号ID、称号名称和原条件列，可直接按已确认索引查名；无需重新猜二进制行偏移。原来源缺口是账户获取/持有/选用到原Odl角色索引的producer，表内条件列不单独证明服务端授予和选用规则。

## picVIPN：VIP 徽章已确认来自角色 m_bVIP，仅在擒王模式显示

- 消费 `0x4d15de–0x4d1629`：当 HUD 模式 `+0x80==2`（原编号 2 = Web 模式 3，擒王）且该玩家
  布尔 `[vtable+0x1c](2)` 为真时，显示 `picVIPN`（controller `+0x5c8+4*N`，绑定 `0x4c8bb8`）；
  否则隐藏。
- 布尔属性选择子 2 对应注册名 `m_bVIP`（注册 `0x522377` 名字 `0x5d8524`，写入角色 DB `+0x50`）。
- 图集为 `zhandou00/wanjiatouxiang_vip.tga`，即正式任务合同里的 `HudPlayer.isVIP`（来自
  `player.isVIP`）。

因此 `picVIPN` 的规则是：仅 Web 模式 3 且 `player.isVIP` 为真时显示。它不是称号、不是勋章、
也不代表其它模式。`game_main.xml` 内没有独立“勋章”控件；现有唯一徽章就是 `picVIPN`。

## 无来源项：3D 头顶标签

未定位到 3D 头顶名字/称号的 producer。已找到的姓名/称号来源只有 `m_sNickName`（角色 DB
`+0x18` 字符串）与上面的 `txtPlayerTitleN` 链。截图中的头顶标签在本片没有原执行或资源合同
支撑，不作声明。小地图按既有 `isHiddenByOpticalCamouflage` 过滤敌方目标，`roleDisguise`不删除地图目标身份。当前世界标签由 `BattlePlayerLabels` 投影实际渲染的 `TankView.root`、姓名和生命；被角色伪装替代而隐藏的原战车不绘制标签。这个可见性策略是明确的Web呈现，不称为已恢复的原世界标签规则。

## 结论

- `txtPlayerTitle*`：控件与原字段 `m_iNowTitle`（选择子 `0x1e`→`title.dat`）已确认；原账号“持有/选用”producer仍有边界；Web快照选用称号已消费，缺值默认显示ID1“嗷嗷待哺”，不据默认授予账户称号。
- `picVIP*`：确认规则（Web 模式3且 `m_bVIP`），正式UI已消费快照 `isVIP`。
- 勋章：战斗HUD无独立控件；Home九奖项统计已从实际持久结算历史聚合并沿RoleProfile供给页面（`home-award-summary.md`），原统计producer仍缺来源。
