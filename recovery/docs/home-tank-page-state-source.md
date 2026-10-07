# 我的家战车/装备整页剩余状态原来源与采用合同

范围：M5-07 / UI-32，原 `myhome_panzerpage.xml` 共用页（`rdoTank` 战车模式与
`rdoEquip` 装备模式）。内容限定为剩余整页状态组：`txtTankStatus`、`txtListQuantity`、
`txtMoney`、`txtOriginality`、`btnModifyFire`/`btnModifyPanzer` 与其子等级、`btnUse`/
`picAlreadyUsed`，以及两模式下的右侧参数区。已实现的 E/current 名单、说明文字、五参数、
BW 宠物参数不属于本片。

原页面类构造函数 `0x4ea14c` 载入 `data\ui\layouts\myhome_panzerpage.xml`（页名前缀
`MyTank/`，字符串 `0x5d2edc`/`0x5d2f04`），逐个 `getWindow` 后把控件指针存入页对象。
与本片相关的页对象偏移：

| 偏移 | 控件 | 构造函数存储点 |
|---|---|---|
| +0x8c | `txtTankStatus` | `0x4ea2a5`–`0x4ea2a8` |
| +0x98 | `txtAttackLevel` | `0x4ea364` |
| +0xa4 | `txtPanzerLevel` | `0x4ea3c8` |
| +0xc8 | `btnModifyFire` | 构造函数 |
| +0xcc | `btnModifyPanzer` | 构造函数 |
| +0x10c | `picAlreadyUsed` | 构造函数 |
| +0x110 | `btnUse` | 构造函数 |
| +0x114 | `txtOriginality` | 构造函数 |
| +0x118 | `txtMoney` | 构造函数 |
| +0x11c | `rdoTank` | `0x4eaaa0` |
| +0x120 | `rdoEquip` | `0x4eaada` |
| +0x124 | `picTankPanel` | `0x4eab14` |
| +0x128 | `picEquipPanel` | `0x4eab4e` |
| +0x12c/+0x130/+0x134 | `rdoCommon`/`rdoHat`/`rdoMark` | `0x4eab88`/`0x4eabc2`/`0x4eabfc` |
| +0x138 | `lstTank` | `0x4eac36` |
| +0x13c | `lstEquip` | `0x4eac70` |
| +0x140 | `txtListQuantity` | `0x4eacaa` |

基类构造函数 `0x4e75fc`/`0x4e80f3` 把 +0x10c..+0x140 清零（`0x4e81d2`–`0x4e8220`）。
`0x4e8d64` 是本页「按当前显示实例刷新右/下参数区」的整页刷新方法；`0x4e70b9` 是余额
生产者；两模式的名单/数量刷新分别在 `0x4ecc2b`（战车列表）与 `0x4e8621`（装备列表）。

## 模式切换与刷新调用链

`rdoTank`（+0x11c）与 `rdoEquip`（+0x120）在 `0x4ed314` 初始化时都注册到同一处理函数
`0x4ed223`（`0x4eddb8`–`0x4ede33`）；`rdoCommon`/`rdoHat`/`rdoMark` 注册到 `0x4e8cf9`。

- `0x4ed223` 判断触发控件与 +0x11c/+0x120：
  - 命中 `rdoTank`：`[esi+0x78]=0`，`picTankPanel`(+0x124) 显示、`picEquipPanel`(+0x128)
    隐藏，随后调用 `0x4ecc2b` 重建战车列表并刷新 `txtListQuantity`。
  - 命中 `rdoEquip`：`[esi+0x78]=1`，`picTankPanel` 隐藏、`picEquipPanel` 显示，把
    `rdoCommon`(+0x12c) 置选中，然后以 Profile getter `0x1d` 解析当前出击实例并调用
    `0x4e9a74`，把显示实例 `[esi+0x20]` 复位为当前出击战车。
- `0x4e8cf9` 把触发控件与 +0x12c/+0x130/+0x134 比较得到分类 `0..2`，调用 `0x4e8621`
  重建 `lstEquip` 名单并刷新 `txtListQuantity`。
- `0x4e9a74` 以 id 经 `0x421f36` 取实例写入 `[esi+0x20]`，再调用 `0x4e6231` 与
  `0x4e8d64`。战车名单行选择处理 `0x4ea126` 取 `lstTank` 选中项 `+0x9c` 后也走 `0x4e9a74`。

因此 `[esi+0x20]` 是右侧参数区当前显示的实例：战车模式由 `lstTank` 选择驱动，装备模式
由 Profile 当前出击目标复位驱动。

## 各状态组原写入与显隐事实

### txtTankStatus（+0x8c）

原页面类中 `txtTankStatus` 只有构造函数 `0x4ea2a8` 写入控件指针，以及基类
`0x4e8160` 把字段清零；`0x4e8d64` 从 +0x84 写到 +0xc4 时不写 +0x8c。整页
update/selection/模式切换链没有任何 `setText` 目标指向 +0x8c，也没有门禁/文字键。
原控件保持 XML 初值，即空字符串。

### txtListQuantity（+0x140）

两模式都写同一个 `txtListQuantity`，来源是当前活动列表的 `MultiColumnList::getRowCount`
（导入槽 `0x5c0104`），格式 `sprintf_s(buf, 0x20, "%d/%d", rowCount, 0x14)`
（`%d/%d` 字符串 `0x5cc4a8`，常量 `0x14` 在调用前压栈，作为第二个参数 `20`）：

- 战车模式（`0x4ecc2b`）：对 `lstTank`(+0x138) 取 `getRowCount`，在 `0x4ecea2` 计算，
  `0x4ecedd` 写入 +0x140。
- 装备模式（`0x4e8621` 的 Common/Hat/Mark 分支）：对 `lstEquip`(+0x13c) 取
  `getRowCount`，分别在 `0x4e8826`/`0x4e8a38`/`0x4e8c38` 写入 +0x140。

即原义为「当前名单已载入行数 / 20」，`20` 是列表分页容量。

### txtMoney（+0x118）与 txtOriginality（+0x114）

生产者是 `0x4e70b9`：经 `0x4269c4` 取当前角色 Profile，压入 getter `0x1f`（`0x4e70f6`）
以 `%d`（字符串 `0x5c83d4`）写 `txtOriginality`(+0x114，`0x4e7138`），再压入 getter
`0x1a`（`0x4e714e`）以 `%d` 写 `txtMoney`(+0x118，`0x4e7190`）。调用点为页面的激活/
更新路径 `0x4ecb0c`、`0x4ecc16`、`0x4ed0d1`、`0x4ed1a0`。因此两模式的余额都随当前
角色 Profile 刷新，与显示实例无关。

### btnModifyFire / btnModifyPanzer（+0xc8/+0xcc）与子等级（+0x98/+0xa4）

两个按钮是右侧属性区 `tankeshengjiqu` 的常显子控件；`0x4e8d64` 按 `[esi+0x20]`
刷新其子等级文本：`txtAttackLevel`(+0x98) 取 `[tank+0x44]`（`0x4e8ffd`/`0x4e903a`），
`txtPanzerLevel`(+0xa4) 取 `[tank+0x54]`（`0x4e91d7`/`0x4e9214`）。

页面类中没有把 +0xc8/+0xcc 置显示/隐藏或置禁用的 setter：`0x4e8d64`、`0x4e71ad`、
`0x4ed223`、`0x4e5e08` 都不写这两个偏移。因此原页面在战车与装备两种模式下都保持两按钮
可见、可用，等级文本跟随当前显示实例（当前出击或浏览候选均为 `[esi+0x20]`）。

点击处理 `0x4eb682`（Fire）与 `0x4ec04d`（Panzer）都读 `[esi+0x20]` 的等级
（`+0x44`/`+0x54`）并 `+1`，再到 `tankup` 表查下一等级记录：查到则填改装 Sheet
（+0x144 起，含 `txtMoneyExpense`/`txtOriginalityExpense`/概率文本）并显示；查不到
（`0x4ebc53`/`0x4ec61d` 及 `cmp edi,0xff` 越界分支）不打开 Sheet。原页面不按
current/candidate 区分这两个按钮，资格只取决于下一等级是否存在。

### btnUse（+0x110）与 picAlreadyUsed（+0x10c）

`0x4e8d64` 先取显示实例 `[esi+0x20]`（`0x4e9381`）与当前 Profile getter `0x1d`
（`0x4e9389`）比较：

- 相等（显示实例就是当前出击战车）：`0x4e9872` 隐藏 `btnUse`，`0x4e9882`/`0x4e9a45`
  显示 `picAlreadyUsed`。
- 不相等：`0x4e9890` 起刷新部件指示后，`0x4e9a33` 显示 `btnUse`，`0x4e9a43` 隐藏
  `picAlreadyUsed`。

`btnUse` 点击处理 `0x4e6305`（注册点 `0x4ed4ba`）取 `[esi+0x20]`，与 Profile 当前
出击实例（vtable +0x40）比较，不同则以 `[tank+0x1c]` 调用 `0x4265e5` 提交为当前出击。
因为进入装备模式时 `0x4ed2ff` 先把显示实例复位为当前出击战车，装备模式下该比较相等，
故默认显示 `picAlreadyUsed`、隐藏 `btnUse`，与战车模式中「浏览非当前实例」时相反。

### 参数区（右侧 tankeshengjiqu / 底部 tankecanshuqu）

`0x4e8d64` 在两种模式下都从显示实例 `[esi+0x20]` 刷新右侧数值、`edtTankDesc`
（+0x94，构造时经 `0x4ea337` 置 Disabled）与底部参数/装填进度。参数区本身不随
`rdoTank`/`rdoEquip` 显隐，只随显示实例变化。

## 采用合同

原来源与采用分开：以下为在现有 Web 数据上实现整页状态组的明确合同，不新增未知
offset、钱包、免费 grant、权限或持久交易。

- `txtTankStatus`：原页面无 producer，保持空字符串即与原控件一致，不作为缺失功能。
  若产品需要状态文字，唯一有原依据的分类是「显示实例 `===` 当前出击目标」，可与
  `picAlreadyUsed` 同条件渲染为台词；选择依据只能是已确认的 `OwnedRoles` 当前目标
  （RoleProfile `a8`）或 `Inventory`/`Equipment` 已确认字段，不推断未知 offset。
- `txtListQuantity`：采用「当前活动名单行数 / 20」。战车模式用当前角色拥有的战车数
  （现 `owned.equipment` 或 `OwnedRoles` 已确认列表长度），装备模式用当前装备分类
  （Common/Hat/Mark）的已确认名单长度。渲染 `${rows}/20`；`rows` 超过分页容量时按
  原样显示，不额外截断。
- `txtMoney`/`txtOriginality`：沿用 typed `growth` 与 RoleProfile 余额映射，保持现有
  `profile.bytes[0x70]` 金额与 `growth.originality ?? playerSummary.originality`
  原创（对应原 getter `0x1a`/`0x1f`），两模式都用同一生产者语义，不随显示实例变化。
- `btnModifyFire`/`btnModifyPanzer` 与子等级：绑定当前显示战车记录，等级文本取记录
  字段 `0x44`（火力）与 `0x54`（装甲），两模式都可见。点击复用现有 `TankUpgrade` API
  （`PtlTankUpgrade` 的 `QUERY`/`UPGRADE`，`instanceId` + `action 1|2`）；是否存在下一
  等级由已确认的 `tankup`/quote 决定，与 `HomeTankUpgradeEntries` 现有资格判断一致。
- `btnUse`/`picAlreadyUsed`：沿用「显示实例 `===` 已确认当前出击目标」判定。相等显示
  `picAlreadyUsed` 并禁用/隐藏 `btnUse`；不相等显示 `btnUse` 并复用现有 `selectRole`
  确认事务提交当前显示实例。装备模式显示实例为当前出击战车，因此默认显示
  `picAlreadyUsed`。
- 装备页 `txtListQuantity` 与升级入口：`HomeEquipmentView` 已持有当前目标战车记录，
  可直接复用 `HomeTankSourceRegions`/`HomeTankUpgradeEntries` 与 `HomeTankUpgradeDialog`，
  数量沿用同一「名单行数 / 20」规则。装备模式 `alreadyUsed` 采用现
  `equipment.tankInstanceId === currentTankInstanceId`，不新增字段。

## 可接 props 与可复用事务

`HomeTankSourcePage` 已接收 `money`、`originality`、`quantity`、`alreadyUsed`、
`busy`、`canUse`、`record`、`openUpgrade`、`openEquipment`，可直接承载本片全部状态：

- 数量：`quantity` 由调用方传入 `${rows}/20` 字符串化的行数（现传整数，改为按上述
  合同计算即可）。
- 余额：`money`/`originality` 由现 `home-roles.tsx` 的 typed 余额与
  `home-equipment.tsx` 的 `equipment.profile`/`growth` 提供。
- 升级：`openUpgrade(instanceId, action)` 复用既有 `HomeTankUpgradeDialog` 与
  `PtlTankUpgrade` 的 `QUERY`/`UPGRADE`，不需要新服务端方法。
- 装备页：`HomeEquipmentView` 已有 `equipment`、`owned.equipment`、`currentTankInstanceId`
  与 `HomeTankSourceRegions`/`HomeTankUpgradeEntries`，可补齐 `txtListQuantity` 消费者与
  升级按钮消费，无需新 direct dep。

## 未完成

- 当前 `home-tank-source-page.tsx` 与 `home-equipment.tsx` 的 `txtTankStatus` 均渲染空
  字符串且无 producer；原页面同样为空，此项按现状保留。
- 当前装备页没有 `txtListQuantity` 消费者，也没有 `btnModifyFire`/`btnModifyPanzer`
  消费者；原共用页两模式都写 `txtListQuantity` 并在右侧常显改装入口，装备页补齐即达到
  整页状态合同。
- 原右侧/底部参数在装备模式的意义仅由显示实例驱动，未额外按模式过滤；装备页沿用同一
  实例刷新即可。
