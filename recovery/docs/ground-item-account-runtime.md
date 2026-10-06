# 地面物品账户事务运行时

实现 `ground-item-business-design.md` 的账户子项与 `remaining-skill-business-design.md`
Func20 的类别 6 入账消费者。新模块 `apps/server/src/accounts/ground-items.ts` 提供
`GroundItemAccountRuntime`，`AccountStore` 仅新增一个私有字段与两个转发方法。

## 接口

```ts
interface GroundItemAcquireContext {
  roomId: string; round: number; groundId: string; itemTableId: number; quantity: number;
}
interface GroundItemDiscardContext {
  roomId: string; round: number; groundId: string; instanceId: number;
  expectedOwned: number; itemTableId: number; quantity: 1;
}
interface GroundItemDiscardResult {deleted: boolean; remaining?: InventoryWireRecord;}

class GroundItemAccountRuntime {
  constructor(database: DatabaseSync);
  acquireOwnedItem(accountId: string, context: GroundItemAcquireContext): InventoryWireRecord | undefined;
  discardOwnedItem(accountId: string, context: GroundItemDiscardContext): GroundItemDiscardResult | undefined;
}

// AccountStore forwards
acquireOwnedItem(accountId, context): InventoryWireRecord | undefined;
discardOwnedItem(accountId, context): GroundItemDiscardResult | undefined;
```

`GroundItemAccountRuntime` 接 `AccountStore` 的现 `DatabaseSync` 实例，不建第二个连接；
`AccountStore` 构造器里在既有字段初始化后加 `this.groundItems = new GroundItemAccountRuntime(this.database)`。
两个 context 类型独立导出，World/ground producer 只按结构形状消费，不引全局 callback。

## 合法输入

两个入口先跑同一组门禁再进事务：

1. `itemTableId` 为正 uint32；`quantity` 为 `1..0xffffff`。
2. `classifyInventoryCategory(itemTableId)` 落在类别 1..6；类别 7 及其它不接地面写入。
3. `itemTableId` 必须存在于现 `combat-catalog.json` 的已知物品定义，取 `battleUseMax` 用于
   既有槽位同步。

丢弃另要求 `quantity === 1`、`instanceId` 为正 uint32、`expectedOwned` 为正 uint32。丢弃的
比较在 `BEGIN IMMEDIATE` 内按 `instanceId` 取行，再核对 `itemTableId` 与 `ownedQuantity`，
任一不符直接 `ROLLBACK` 返回 `undefined`，不改数量、快捷槽或资料。

## 事务与收据

两写都复用现 `inventory` 表与 `InventoryWireRecord`，在同一个 `BEGIN IMMEDIATE` 事务里写
库存和收据，成功才 `COMMIT`；抛错一律 `ROLLBACK` 后原样抛出，不吞异常、不返回假成功。

新表 `ground_pickup_receipts` 与 `ground_discard_receipts` 以 `ground_id` 为主键，存
`account_id/room_id/round/item_table_id/instance_id/quantity`。`groundId` 由 ground producer
给的稳定身份（含 run UUID 与 room/round）组成，不是哈希。键已存在的处理：

- 同 `accountId` 重放：`acquire` 返回该 `instanceId` 当前库存行，`discard` 返回该实例当前
  `deleted`/`remaining`，都不再加量、不再扣量，也不回放冻结在收据里的旧数量。
- 不同 `accountId`：返回 `undefined`，不加量、不扣量。同一 ground 只能被一个账户取走。
- 首写成功、World 实体删除后迟到的重复请求：命中同一收据，行为与重放一致。

`acquire` 成功返回真实 `InventoryWireRecord`，由调用方在 `COMMIT` 之后删除 World 实体。

## 库存写入

### acquire（拾取入账）

按 `ORDER BY instance_id` 取稳定最低、同 `itemTableId` 的实例：

- 已存在同定义实例：`ownedQuantity += quantity`，保留该行原 `state/slots/float/字段`；若该
  实例占着快捷槽，两贵重品 `20001/20002` 按采用规则把本局可用数抬到真实剩余
  `ownedQuantity` 且不回退已有值；其它原物件仍抬到 `min(ownedQuantity, BattleUseMax)`。
- 无实例：按现 `shop`/`trade` 同样的「跨 `inventory`+`role_records` 取首个未用正 uint32」
  分配 `instanceId`，建类别 1..6 合法 `InventoryWireRecord`：`ownedQuantity=quantity`、
  `battleQuantity=0`、`state=0`、`field8/float*` 取该类型构造器的默认值。这是本项目已采用的
  owned schema，不冒充原记录来源，也不把未知 float 反推成取证事实。

20001 鱼骨 / 20002 骨头的 Func20（`T1/T2`、`X1`、`Y20001/20002`）只做数量加一：
本身不写 HP、不写 tech points；普通 use 不再加一，`ItemSkill2=30005` 改由
`battle/items/treasure-item-use.ts` 在普通请求、存活、缺失生命及真实 skill 定义门禁后
先 CAS 再治疗并各减一；0 价格不构成免费 Shop。类别 1/2 走同一入口，效用仍由既有
healing/item-use 事务在普通使用路径产生。

### discard（丢出地面）

- 剩余 `ownedQuantity > 0`：只更新同一实例数量，保留其它字段，返回
  `{deleted: false, remaining}`。
- 归零：删 `inventory` 行，同一事务删 `hotkeys` 中该实例的绑定，并清 `role_profiles` 中指向
  该实例的 cosmetic/part 选择器（0x118、0x13c、0x140、0x144、0x148、0x14c、0x150、0x154、
  0x158），返回 `{deleted: true}`。这样已确认的 client 当前弹药槽不会指向亡实例。

本人重新拾取只把同一数量搬回，不复制实例 ID 给另一账户；`'DISCARD'` 在丢弃时已扣的库存
不向源账户退款。余额、购买与普通 `consumeItem` 路径不改。

## 重入与边界

- 同账户重放：`BEGIN IMMEDIATE` 串行，收据命中后不再二次加/扣。
- 他人 claim：收据 `account_id` 不符返回 `undefined`，不动库存。
- CPU 无账户：本运行时按 `accountId` 记账，CPU 没有账户绑定就不经这里；真人拾取由认证回调
  提供 `accountId`，CPU 走本轮 local 库存，不写账户 granted。
- CAS/SQL 失败：无数量、槽位或资料变化，也不生成 World 实体。

## Known Issues

- 本子项只落账户持久写入与收据。World 的 ground 实体生成/接触扫描/快照、UI 投影与多连接广播
  由其它 workers 接入，未在本 worktree 实测。
- `combat-catalog.json` 为本项目 Web asset 数据，非源码可重建产物；本运行时按
  `webAssetPath('combat-catalog.json')` 读取，与 `battle/catalog` 同一份运行时资产。
- 概率、掉落池与 dropitem 档位采用规则见 `ground-item-business-design.md`；本子项不重复。
