# Trade 拥有角色候选行状态原来源

范围：UI61/M5-11。内容限定为原 Trade 页 `lstMyTankMyPet` 及两个物品候选名单的行状态来源、
`page+0x140`/`page+0x230` 两张 12 项目录表，以及 SHOW、CONFIRM、撤回、取消和关闭生命周期。
给出的是当前二进制能直接确认的有限静态事实，不替代运行时实测。

## 两张 12 项目录表

Trade 页面构造 `5022cd` 用 `57a8d0` 把 `page+0x140` 与 `page+0x230` 各清 `0xf0` 字节。
`0xf0 == 12 * 0x14`，所以两张表均为 12 项、每项 20 字节。前一版已经确认：

- `page+0x140` 是本方 SHOW 草稿表；SHOW builder `5029f2` 遍历它并构造 `3f9e`。
- `page+0x230` 是收到的对方展示报价表；offer receive callback `4fc91f` 从收到的 offer 记录填充它。

两张表的核心键相同，但记录的附加字段不同：

| 表 | `+0` | `+4` | `+8` | `+c` | `+10` |
|---|---|---|---|---|---|
| 本方草稿 `page+0x140` | kind/类别 | quantity | instance | 本方候选记录指针 | 辅助标记 |
| 收到展示 `page+0x230` | kind/类别 | quantity | instance | base/type 字段 | 未使用 |

`4fa1ff` 只查 `page+0x140` 的 `(kind, instance)`：

```text
for k = 0..11:
    row = page + 0x140 + k * 0x14
    if row.kind == kind and row.instance == instance: return true
return false
```

它从槽 `0` 按升序扫描，返回布尔值；quantity、记录指针和 `+0x10` 辅助标记均不参与判定。

## 本方草稿表写入与候选输入

本方表每项以 `+0xc != 0` 表示已占用。新增路径先找首个空槽，再写 kind、quantity、instance 和
本方候选记录指针。

`5019f5(slot)` 处理候选直接加入：

- 空槽检查在 `501a4b`；已有项时不覆盖并返回 false。
- 宠物页 `[page+0xa4]==0` 写 kind `0`、quantity `1`，instance 取候选记录 `+0`，并拒绝把当前
  已使用宠物放入目录。
- 战车页 `[page+0xa4]==1` 写 kind `1`、quantity `1`，instance 取候选记录 `+0x1c`，并拒绝把
  当前已使用战车放入目录。
- 物品页走 `501bfe`。可堆叠候选先把 kind 和数量提交留给数量输入；非堆叠候选写 quantity
  `1`，kind 为 `43bd09(record) + 1`。分类值 `3..7` 因此落为本方表的 kind `4..8`。
- 数量输入 `500ca9` 把字符串解析为整数，读取 `43d186` 返回记录的 `+0x10` 上限，然后经
  `500a39(slot, quantity)` 写入或更新本方表。
- `500a39` 在 `[page+0xac]==0` 时写 kind `2`，在 `==1` 时写 kind `3`；随后写
  instance=`page+0xb0`、quantity=输入值，并按页签解析候选记录指针。未观察到 `[page+0xac]==2`
  在本函数中写 `+0`。

`5019f5` 和 `500a39` 对命中的候选行调用共享 setter 写状态 `4`。本方表满时 `500ca9` 报错，
不淘汰已有项。

没有恢复出单槽逐项删除写入。`page+0x140` 的成批清空出现在初始化和取消/关闭路径；撤回 SHOW
不清空它。UI 的当前选中背景与 `page+0x140` 的 kind+instance 成员关系是两个不同状态。

## 行类、列表绑定与状态优先级

原 Trade 的列表 controller 与行类必须以实际构造点区分，不能只按 setter 地址分类。

| controller / 列表 | 原工厂 | 行构造 | setter | `+0x1c`/身份 |
|---|---|---|---|---|
| `page+0x11c` 宠物分支 | `4fc584` | `4bc86b` OwnedPet，vtable `5cef78` | `4bd103` | 实例 `record+0` |
| `page+0x11c` 战车分支 | `4fc73a` | `4bb3bc` OwnedTank，vtable `5cef2c` | `4bbcfd` | 实例 `record+0x1c` |
| `page+0x120` 物品列表 | `4fb48a` | `4b886d` MyItem 行 | `4bbcfd` | 实例 `record+4` |
| `page+0x124` 装备列表 | `4fb6fc` | `4b9e77` 装备行 | `4bbcfd` | 实例 `record+4` |

`page+0x11c` 的两个分支共用同一列表控件 `Trade/lstMyTankMyPet`，但宠物分支和战车分支分别
重建 OwnedPet/OwnedTank 行。共享 setter `4bbcfd` 会出现在 OwnedTank 和物品/装备行上，
不能据此把行类判为未知或互相归并。

### OwnedPet 与 OwnedTank

宠物工厂 `4fc584` 遍历 `page+0xb8..page+0xbc` 的宠物记录；当前宠物 getter 为
`4269c4` 返回对象的 vtable `+0x3c`。状态判定顺序是：

1. 候选记录指针等于当前宠物记录指针时写 `3`。
2. 否则查本方表 `(0, record+0)`；命中写 `4`。
3. 都不命中保持 `0`。

战车工厂 `4fc73a` 遍历 `page+0xc8..page+0xcc` 的战车记录；当前战车 getter 为同一对象
vtable `+0x40`。判定顺序是：

1. 候选记录指针等于当前战车记录指针时写 `3`。
2. 否则查本方表 `(1, record+0x1c)`；命中写 `4`。
3. 都不命中保持 `0`。

因此在本方草稿中的当前宠物/战车得到 N 而不是 B：N 的指针相等分支在前，命中后不再查
`page+0x140`。这里的 N 来源是原角色管理对象的当前记录 getter，不是 trade offer 状态，
也不是候选行自己的字段。

OwnedPet 构造 `4bc86b` 在 `4bc8d8` 清零 `+0x32c`；OwnedTank 构造 `4bb3bc` 在 `4bb43c`
清零 `+0x3c4`。两支 draw 的状态 `3` 使用原字符串对象 `0x5cee74`，资源为 `n.tga`；
状态 `4` 使用原字符串对象 `0x5c6410`，资源为 `b.tga`。本范围只确认状态 `3`/`4` 的来源
和 `N`/`B` glyph，不把 B 展开成“确认”或任何更强的业务名称。

### 物品与装备列表

`4fb48a` 建 `4b886d` 行。每行先看 `record+0x1c == 2`，成立写状态 `1`；否则按同在
`page+0x140` 的本方表查同 instance：

- 一个分支查 kind `2`；
- 一个分支查 kind `3`；
- 一个分支查 kind `7`；

命中写状态 `4`。`4fb6fc` 建 `4b9e77` 行的三个分支同样先看 `record+0x1c == 2`，再分别查
kind `5` 或 kind `4` 的本方表，命中写状态 `4`。这些行类上的状态 `1` 与状态 `4` 不由
OwnedTank/OwnedPet 的 N/B 推导。

候选列表重建、页签/子页切换和页面初始化会经 `4fab20` 把旧行状态重置为 `0`，再按上述
工厂重算。`4fabeb`、`4fac8f`、`4fadef` 是此重置路径中的状态 `0` 写入，不是状态 `4`
产者。

## 收到的对方展示报价

`4fc91f` 是 offer receive callback。它把收到的 offer 链表写入 `page+0x230`：

- 节点 kind `0` 宠物：quantity `1`，instance=`record+0`，base/type=`record+8`。
- 节点 kind `1` 战车：quantity `1`，instance=`record+0x1c`，base/type=`record+0x24`。
- 节点 kind `2..8` 物品：quantity=`record+0x10`，instance=`record+4`，base/type=`record+c`。

回调随后把 offer 的三个标量写到 `page+0x320`、`page+0x324`、`page+0x328`，并刷新页面。
若本方已经 SHOW、对方报价存在且本方未 CONFIRM，`4fc9e1..4fca03` 启用确认控件。

`4fca10` 是 show reply callback。收到 side 不等于 `page+0x98` 时，它清空 `page+0x230`
全部 12 项、三个标量字段和对方 offer 对象，重置 `page+0x21`，禁用确认并恢复展示按钮；
本方草稿 `page+0x140` 不动。收到同 side 时清除本方 SHOW 标记 `page+0x20` 并更新展示控件，
同样不写本方草稿表。

## SHOW、CONFIRM、撤回、取消与关闭

`5029f2` SHOW builder 要求 `page+0x20==0` 且 `page+0x9c` 存在。它遍历 `page+0x140`
全部 12 项：

- kind `0` 取宠物记录；
- kind `1` 取战车记录；
- kind `2..8` 取物品记录，并按 kind/tail 写 offer；

随后发送 `3f9e` 并把 `page+0x20` 置 `1`。若已经展示，`502c15` 转 `4933c0` 发送 `3fa0`；
撤回不逐项清除 `page+0x140`。

CONFIRM 回调 `4f9a2e` 要求控件可用且 `page+0x21==0`。它发送 `3fa2`，把 `page+0x21`
置 `1` 并禁用 SHOW。该函数不清空 `page+0x140` 或 `page+0x230`。所以目录成员关系仍表示
本方草稿，不表示服务端确认；对方展示另由 `page+0x230` 表示。

取消 `4fd161` 先发送 `3fad`，再调用 `4fcbe9`。本地关闭 `4fd13e` 直接调用 `4fcbe9` 后关闭，
不发取消消息。`4fcbe9` 清理 offer 对象、三个对方标量、`page+0x140` 和 `page+0x230`
两张表的全部项及对应控件状态；重建/重新初始化也在 `4fc495` 清这两张表。

失败加入只返回 false 或报错，不淘汰已有目录项；offer receive 不覆盖本方 `page+0x140`；
show reply 的不同 side 分支只清对方表。原服务端确认失败后的逐字段回滚不在本页行状态范围内。

## Web 采用合同

当前 `PtlTrade` 和 `MsgTradeState` 提供：

- `TradeParty.records`/`TradeParty.offer.records`：已确认会话中的提供记录和引用；
- `TradeParty.shown`、`TradeParty.confirmed`：双方展示和确认状态；
- `TradeSession.phase`、`revision`、`reason`：会话生命周期；
- `TradeRecordRef.kind` 与 `TradeRecordRef.instanceId`：稳定行身份。

当前 Web 的候选行身份等式应为：

```ts
const sameRecord = (a: TradeRecordRef, b: TradeRecordRef) =>
  a.kind === b.kind && a.instanceId === b.instanceId;
```

采用规则：

1. OwnedTank/OwnedPet 的 N 使用同一确认 `TradeAccount.profile.bytes`；Web 没有原角色记录
   指针，只能用当前角色的 `kind + instanceId` 身份等式。缺失 profile、bytes 短于字段或字段
   不命中时保持无 N，不从候选第一项、selected 或 trade draft 推断。
2. 原 B 的直接来源是 `page+0x140` 本方本地 SHOW 草稿。Web 对应物是本地
   `draft.records` 的 `kind + instanceId` 成员关系，不是 `aria-selected`/候选选中背景，
   不是 `party.confirmed`，也不是 `own.offer` 之外的猜测。
3. N 优先于 B：同一 OwnedTank/OwnedPet 候选同时命中当前实例和本地 draft 时显示 N，不显示 B。
4. 对方已展示报价只在 `peer.shown` 为 true 时读取 `peer.records`/`peer.offer.records`。
   `TradeParty.confirmed` 是独立确认标志，不能替换 B/N。
5. session id 变化或本方确认 offer 变化时，按现有 `TradeSourcePage` 规则从 `own.offer`
   重置本地 draft；revision 只用于请求一致性。对方 SHOW、UNSHOW、单方 CONFIRM 或对方
   撤回/失败只更新服务端展示和确认状态，不单独因 revision 变化清除未提交 draft。
   CANCEL、COMPLETED、关闭、断线会话结束后不把 B/N 留在新的会话视图。
6. 不把候选 selected 状态冒名为 B；B/N 应各自有独立 badge/asset，并在同一行内按优先级显示。

当前 confirmed fields 足够驱动双方 12 格视图、SHOW/CONFIRM/UNSHOW/CANCEL 门控和
失败状态处理。B/N 是客户端派生状态；没有原服务端字段必须伪造。

## 可实施 UI 范围

下列最小生产改动边界已按当前正式接线落地：

- `apps/web/src/interface/account/trade-source-page.tsx`：每次 render 从确认
  `TradeAccount.profile.bytes` 读取当前实例（小端 tank `+0xa8`、pet `+0xa4`），以
  `kind + (instanceId>>>0)` 相等计算 current（N）；`draft.records` 保持为唯一 B 来源，
  N 优先。页面不再使用专用 `RoleProfile` QUERY effect、`currentRoles`、query props 或
  `LobbySocialView` query callback。
- `apps/web/src/interface/account/trade-candidate-row-content.tsx`：接收 current/offered，
  OwnedTank/OwnedPet 渲染 N 或 B，物品/装备行不把 Trade B 扩成 E/S；`!current && offered`
  时才渲染 B。
- `apps/web/src/interface/home/home-role-row-status-badge.tsx` 及其 CSS：N/`offered` glyph
  均已存在，直接复用 `n.tga`/`b.tga`，仅在 `.trade-source-candidate-row` Trade 作用域内
  应用 `point 5,8`、14×14 几何。

无需新增 server API、协议 schema、轮询、缓存、费用或取得链。`PtlTrade`/`MsgTradeState`
已是当前确认状态合同；当前角色投影随同一确认快照进入 Trade 本方候选。

## Known Issues

- 原服务端对 `3f9e`、`3fa1`、`3fa2` 和完成消息的资格、失败返回及事务字段不在本次来源中；
  Web 的权威状态来自现有重建服务。
- 本方目录表未恢复出单槽逐项删除回调；已确认的是整表清空、撤回保留和新增首空槽。
- table kind `2..8` 的完整业务名称没有全部恢复；当前可直接使用的是原 kind 常量和
  `TradeRecordRef.kind`，不据此猜道具/装备分类名。
- OwnedTank/OwnedPet 的状态 `1`/`2` 在本页候选链没有 producer；不把 S/E、当前角色、
  selected 或确认状态填到这两个状态。
- 原角色 getter 在 Web 侧没有独立字段；当前实例直接取自同一确认
  `TradeAccount.profile.bytes`。无 profile、bytes 短于字段或字段不命中时保持无 N，N 不由
  B、selected 或 draft 推导。
- 本来源是有限静态结论，不称原交易流程、HD、导出或持久化已完成。
