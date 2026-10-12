# Trade 非角色物品/装备候选行状态表现

范围：UI61/M5-11 生产页面中本方 `lstMyItem` 与 `lstMyEquip` 非角色候选行的 `E`/`B`
状态呈现。原分派与状态来源见 `trade-item-row-status-source.md`；本方角色 N/B 见
`trade-owned-row-status-presentation.md`。原服务端授权、CEGUI 内部字形放置与逐 148
控件精度不在本页。

## 状态来源与优先级

- `E` 来自同一确认 `TradeAccount.profile.bytes` 的当前角色投影：cat `5` 比较五个部件槽
  `+0x148 + 4*slot`（`slot 0..4`），cat `3` 比较帽子/气球装饰 `+0x118`，cat `4` 比较标志
  `+0x13c`。同一次 render 的候选 `instanceId` 命中对应槽即 `current`。
- `B` 来自本地 `draft.records.some(ref => ref.kind === record.kind &&
  ref.instanceId === record.instanceId)`；`draft.records` 是唯一 B 来源。
- 非角色行按原状态顺序先判 E，命中 E 不再画 B；仅 `!current && offered` 时渲染 B。

行身份只使用当前稳定 `TradeRecordView.kind === 'item'` 与 `instanceId`，原 kind 数字与
`category`/`itemTableId` 只用于子页分类。没有 profile、bytes 短于所用字段或槽位不命中时
不画 E；cat `7` 不画新 E。不使用 `inventory.records[].state===2` 的全账号安装标记，也不
依据 selected、`bindingName`、`party.confirmed`、peer 或额外 `ownedQuantity` gate。原
物品名单 `ownedQuantity>0` 过滤与装备名单无数量 gate 的来源事实保持，不新增 Web E gate。

## 消费者、资源与几何

`TradeSourcePage` 把同一候选行的 `current` 与 `offered` 传入
`TradeCandidateRowContent`；非角色装备行把 `current` 传给
`HomeEquipmentCommonRowContent` 的既有 `installed` 入口，并在 `!current && offered`
时追加共享 `HomeRoleRowStatusBadge(status="offered")`。

E/B 直接复用既有 `HomeRoleRowStatusBadge` refs：E 为
`data\ui\xiaoheitizi\e.tga`（`ui/regions/11/9.png`），B 为
`data\ui\xiaoheitizi\b.tga`（`ui/regions/11/8.png`）。角色 N 的
`ui/regions/11/10.png` 不变。三者都是原 `SmallHT` 的 `14×14` region，采用 Trade 作用域
`point (5,8)`、随父 scale；不新增 font、cache、renderer 或未知枚举。Home consumer 已有
refs、ARIA 与几何保持；原 `CEGUI::Font::drawText` 内部像素放置、HD 比例与逐像素仍未知。

## Draft 与生命周期

E/N 是每次 render 从确认 `TradeAccount.profile.bytes` 读取的纯投影；无 profile 或短
bytes 时对应标识不画。B 沿用本地 draft 生命期：仅 session id 或本方确认 offer 变化时按
既有 `own.offer` 重置本地 draft，revision 只用于请求一致性；SHOW/UNSHOW、单方 CONFIRM、
UNSHOW 与对方撤回不单独因 revision 改变清未提交 draft。CANCEL/COMPLETED、关闭或断线结束
后由既有 Trade 确认快照清理，不延续 B/E。SourceList 现有类别、资格、数量、12 格、peer、
detail、keyboard/focus、资源 retry 与 pending gate 保持；不新增异步 query、poll、cache、
guard、API、schema、费用或取得。

## Known Issues

- 原 `rdoCommon` 工厂按 `4fa1ff(page,4,inst)` 判 B，与原草稿 kind `6` 冲突；该字面值保留
  在原来源边界。当前 Web B 使用稳定 `TradeRecordView.kind + instanceId`，不复制字面 bug。
- 原 cat `7` 没有已恢复的装备组接收工厂；现 Web 列表保留当前分类，但不能宣称完整原类别
  等价，也不给未知状态伪造 S/N。
- 本轮未做页面、双端、关闭重开、HD、原服务端或逐 148 控件实测。
- 原服务端授权、单槽控件到槽号映射、原 kind 名称边界与原 CEGUI 内部表现仍按原来源文档
  保持未完成。
