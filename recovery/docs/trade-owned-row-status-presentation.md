# Trade 拥有角色候选行状态表现

范围：M5-11/UI-61 生产页面中本方 OwnedTank/OwnedPet 候选行的 `N`/`B` 状态呈现。只覆盖
状态来源、glyph 资源、共享 consumer、位置几何与生命期边界；原服务端授权、CEGUI 内部
缩放/字符推进和逐 148 控件精度不在本页。

## 状态来源与优先级

Trade 本方候选行按原状态语义显示两个字母：

- `N`（当前使用）：`TradeSourcePage` 经 `LobbySocialView` 的稳定 `battle.roleProfile()`
  纯 QUERY 与 `accountContext.generation` 读取确认 `profile.bytes`，小端战车 `+0xa8`、
  宠物 `+0xa4`，与候选 `kind + (instanceId>>>0)` 相等即当前实例。
- `B`（本方交易草稿）：本地 `draft.records.some(ref => ref.kind === record.kind &&
  ref.instanceId === record.instanceId)` 成员关系，`draft.records` 是唯一 B 来源。

N 与 B 都只用于 OwnedTank/OwnedPet。同一候选按原顺序先判 N，命中 N 不再画 B；仅
`!current && offered` 时才渲染 `offered`。`aria-selected`/候选选中背景、`party.confirmed`、
peer 记录、Home 当前候选都不作为 B/N；item/equipment/peer/12 格/detail 不新增状态 glyph，
不给 S/E 或其它 kind 造枚举。

## Glyph、consumer 与几何

两个状态都复用共享 `HomeRoleRowStatusBadge` 消费既有 `SmallHT` 资源：

- N 复用 Home 现 current 图 `data\ui\xiaoheitizi\n.tga`（`ui/regions/11/10.png`）。
- B 用新增 `offered` 状态 `data\ui\xiaoheitizi\b.tga`（`ui/regions/11/8.png`），带
  `data-trade-owned-row-offered` 与 `role="img"`，ARIA 标签「本方交易草稿」。

两者 point `(5,8)`、glyph 资源尺寸 `14×14`，在源行局部坐标系内随父 scale 缩放。CSS 仅
在 `.trade-source-candidate-row > .home-role-row-status-badge` Trade 作用域内应用该几何，
不改 Home current/installed 的 refs、attrs、labels、几何或 producer。

## 生命期与采用边界

当前角色投影只在 Trade 页面打开期间读取，effect 仅在 open/session id/account generation/
query identity 变化时重跑；`active` liveness 在 close、换会话、世代变化后丢弃迟响应。
无确认 profile 或 QUERY 失败时保持无 N，不阻塞 Trade 业务，也不新增 poll、缓存、query 写
参数或 UI gate。

B/N 随本地 draft 生命期：确认 offer/revision/session 变化按既有 `own.offer` 重置，UNSHOW
与对方撤回保留本地 draft，CANCEL/COMPLETED/关闭/断线会话结束后不延续 B/N。既有 Trade
事务、金额/数量编辑、12 提供物与资源 retry 行为保持不变。

## Known Issues

- 真实页面、迟响应切上下文、双端实际交互、关闭重开与 HD 布局尚未实测。
- 原服务端 `3f9e`/`3fa1`/`3fa2`/完成消息的资格、失败与事务字段仍未恢复；Web 权威状态来自
  现有重建服务。
- CEGUI `Font::drawText` 的精确内部缩放、字符推进与位图偏移属于外部实现；本页只采用
  point `(5,8)` 与 `14×14` 资源尺寸，不称原 Windows 字体像素级恢复。
- 原 Trade listfactory 仅有限恢复本方 OwnedTank/OwnedPet 行与其状态来源；其它 kind、完整
  字段、服务端授权与逐 148 控件父项保持未完成。
