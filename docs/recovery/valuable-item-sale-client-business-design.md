# 贵重品数量出售源码终态设计

## 范围与来源事实

本设计覆盖原 kind5 / inventory 分类 6 的贵重品数量出售，只接精确
`itemTableId=20001` 鱼骨、`20002` 骨头。原 sender/receiver 事实为
`495e90 → 494bad(instance,quantity)`，请求 `instanceId32/quantity24`，
回执 `instanceId32/quantity24/result8/fullMoney32`，只有 `result2` 才更新金额和库存。
原类别 6 数量谓词只接受 `20001..21000`，本终态进一步收窄到当前表真实存在的两个 ID，
不扩到整类别 6，也不把 kind3 的 `StackItemSale` 改成 kind5。

当前物品表事实：

- `20001/20002` 都 `classifyInventoryCategory(...)=6`，`ItemType=13`。
- 两者 `ItemMoney=0`、`ItemCoin=0`、`GGet=0`、`Durable=0`、`BattleUseMax=0`。
- 原出售单价为 `uint32(ItemMoney) >>> 1`，两个 ID 都为 `0`；数量乘价也恒为 `0`。
- 合法零收入出售仍必须精确扣已有 owned 数量。不得生成金币、替代资源、取得记录或新 grant。

现有普通取得 producer 已接入：

- `apps/server/src/accounts/ground-items.ts` 的
  `GroundItemAccountRuntime.acquireOwnedItem` 以 ground receipt 幂等写入 owned。
- 新实例分配首个未用正 uint32，已有同表 ID 累加 `ownedQuantity`。
- 已被快捷槽绑定的两个贵重品按 adopted consumable policy 暴露真实 remaining owned；
  未绑定实例的 `battleQuantity=0`。
- `ground-item-business-design.md`、`ground-item-account-runtime.md`、
  `treasure-item-use-runtime.md` 已记录该现态。

现有普通消费 consumer 已接入：

- `AccountStore.consumeItem` 对 `20001/20002` 按 `expectedOwned + itemTableId` CAS 扣一；
  最后一份同事务删除实例和全部快捷槽引用。
- `battle/items/treasure-item-use.ts` 经普通 `useItem` 链治疗并扣 owned/battle 各一。
- 该链不是出售链，不替代本设计，也不负责零收入出售。

## 当前接口边界

当前 `apps/shared/protocols/serviceProto.ts` version 是 `114`，`ValuableItemSale`
占用 API id `58`。已有
`StackItemSale id52` 继续只服务 category 1/2，不追加 category 6 分支，也不给
`PtlStackItemSale` 伪造 kind5 mapping。

采用独立稳定 API：

| 项 | 终态 |
| --- | --- |
| Service name | `ValuableItemSale` |
| Service id | `58` |
| serviceProto version | `114` |
| shared file | `apps/shared/protocols/PtlValuableItemSale.ts` |
| server domain | `apps/server/src/accounts/valuable-item-sale.ts` |
| server API | `apps/server/src/accounts/valuable-item-sale-api.ts` |
| AccountStore method | `valuableItemSale(accountId, request, catalog)` |

固定新增 API 身份，不改 `StackItemSale` 的 id52、请求结构、返回结构或 kind3 语义。
共享协议与 schema 已登记为 version `114`。

```ts
export interface ReqValuableItemSale {
  operation: 'QUERY' | 'SELL';
  instanceId?: number;
  quantity?: number;
  requestId?: string;
}

export interface ResValuableItemSale {
  quotes: {
    instanceId: number;
    itemTableId: number;
    ownedQuantity: number;
    unitPrice: number;
    canSell: boolean;
  }[];
  inventory: ResInventory;
  money?: number;
  profile?: {bytes: number[]; strings: [string, string]};
  sold?: {
    instanceId: number;
    itemTableId: number;
    quantity: number;
    price: number;
    result: 2;
  };
  replayed?: boolean;
}
```

`QUERY` 与 `SELL` 都返回提交当时的账户投影：完整 `inventory.records/hotkeys`、
selector26 的完整 `money`、以及原 profile bytes/strings。`money` 不是增量，是当前
uint32 值；两个精确 ID 的出售价恒为 `0`，出售不会改变它。

`quotes` 只含当前账户内 `itemTableId` 为 `20001` 或 `20002` 的记录。`unitPrice` 为
`item.moneyPrice >>> 1`，两个 ID 均为 `0`。`canSell` 只在
`ownedQuantity > 0 && money + unitPrice <= 999999999` 时为真；零价条件下该余额门禁自然成立。

## 服务端事务

`AccountValuableItemSale` 接入 `AccountStore` 的同一 `DatabaseSync`，不建第二个数据库
连接。表：

```sql
CREATE TABLE IF NOT EXISTS valuable_item_sale_receipts (
  account_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  instance_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  receipt TEXT NOT NULL,
  PRIMARY KEY(account_id, request_id)
);
```

门禁与事务顺序：

1. 账户必须存在；`SELL` 必须在 `BEGIN IMMEDIATE` 前完成 room/trade 门禁。
2. `instanceId` 为正 uint32；`quantity` 为正整数且 `1..0xffffff`。
3. `requestId` 沿用现账户 API 字符串约定 `^[A-Za-z0-9_-]{8,80}$`；现 Web
   `createRequestId` 生成的小写十六进制串是一个合法 producer，但不是新增的只允许 hex
   的额外资格。`QUERY` 不需要 requestId。
4. 事务内先查 `(account_id, request_id)` receipt。已存在且 `instance_id/quantity`
   相同，返回当前账户投影并带 `replayed:true`；参数不同则拒绝，不扣第二次。
5. 首写按 `instanceId` 从当前账户 inventory 取行，核 `itemTableId` 必须是
   `20001/20002`，`quantity <= ownedQuantity`。
6. 计价为 `unitPrice * quantity`，两个 ID 下为 `0`。事务内仍核当前 `money + price`
   不超过 `999999999`；该出售不会产生金钱增量。
7. 部分出售：更新同实例，保留所有其它原字段；`ownedQuantity=remaining`。
8. 完全出售：删除 inventory 行，删除 `hotkeys` 中同实例全部槽引用；`role_profiles`
   完全不变，`payload.bytes/strings` 原样保留，`payload+0x70` money 不改。
9. 写 receipt，生成 `{instanceId,itemTableId,quantity,price,result:2}`，提交后返回
   当前账户投影；任意异常 `ROLLBACK`，不改库存、hotkeys、profile 或 receipt。

Partial 的 `battleQuantity` 采用当前 confirmed consumable policy，而不是原类别 6
仅保留 battle+20 的旧行为：若该实例仍在实际 `hotkeys` 中绑定，设为 remaining owned；
若没有任何实际绑定，设为 `0`。这样 `BattleItemInventory` 和快捷槽不会看到大于 owned
的可用量，也不把未绑定库存自动塞入战斗槽。

完全出售清引用只触及贵重品库存和实际 `hotkeys`。`20001/20002` 的合法引用是消耗快捷槽，
不会进入皮肤、装饰、标记或部件 selector；因此清除范围不扩到 `role_profiles.payload`
中的装备或外观字段。零收入出售同样不写 money，profile bytes/strings 保持原样。

## room、trade 与生命周期

`SELL` 按 `identities` 收集该账户的全部当前实际 room session，执行账户级阶段门禁：

- 无 room 或所有对应 player 的 `world.canConfigureInventory(playerId) === true`
  （均 `WAITING`）时允许出售。
- 任一当前 session 处于 `LOADING/PLAYING/FINISHED` 时拒绝，错误 code 为
  `VALUABLE_ITEM_SALE_REJECTED`。
- `QUERY` 在任意 room stage 只读当前投影，不改库存。

交易互斥在 `SELL` 前执行：若该账户在 `registerTradeApi` 的 active trade session 中，
返回交易未结束错误，不与 `Trade` 的 `prepare/settle` 并发写同一账户。该门禁复用
现有 trade 状态，不复制 `Trade` session，也不改变旧 `StackItemSale` 或旧注册模块资格。

首次成功 `SELL` 且 `sold && !replayed` 时，服务端读取同一份确认 inventory，逐当前该账户
允许配置的 player 调用 `world.bindInventory(playerId, inventory, true)`，取消其 Ready，
并按真实 `roomId` 去重后各广播一次房间状态。无关联账户或 room 不写；历史 receipt replay
只返回历史 sold 与当前投影，不重新取消 Ready、不重新广播。`BattleItemInventory` 通过
`inventoryChanged`/刷新安装同一确认 owned；不得用响应前猜测的 count 覆盖。

`selectedItemSlot` 是客户端本机 cursor，不是账户字段。实例完全删除或
`battleQuantity=0` 后，`BattleItemInventory.resolveCursor` 按确认 inventory 重算；
若该实例不再可用，则回退到首个可用槽或 undefined。这里不新增服务端 selectedShortcut
字段，也不把客户端 cursor 写进账户。

实例生命周期继续由账户持久行和 ground receipt 决定：

- `startRoom`、`finishRoom`、换轮不重放 grant，也不恢复已出售实例。
- ground acquire producer 仍是 `20001/20002` 的唯一普通取得入口。
- 出售不是取得、也不是普通使用；不改 Drop table、不改 `ground_pickup_receipts`。
- 最后一份普通 use 与最后一份出售都删除 inventory 与全部引用，二者互斥由账户事务串行化。

## Web 消费者终态

入口复用当前 Home owned 贵重页：完整父引用为 M5-09 / UI36 / UI65 及 M6-06，不把
UI53 或商城 Item 购买页当成本出售入口。使用 `HomeInventoryView` 的
`page='valuable'`、`HomeInventorySourceList valuableRows`、
`HomePlayerSourcePage valuableMode`。商品 Shop 的贵重 radio 仍保持原隐藏/空状态，
本设计不新增免费商店、商品库存或自动 owned 记录。

数量确认复用原 `userinput_dialog.xml` 的 9 项控制：5 个背景/框图片、`txtMessage`、
`edtInput`、`btnOK`、`btnCancel`。新增
`apps/web/src/interface/home/home-valuable-sale-source.tsx`，并从现
`interface/account/stack-item-sale-source.tsx` 导出原 `StackSaleQuantityDialog` 供 Home
贵重出售复用；必要时只给该对话框加可选 label/标记参数。kind5 与 kind3 保持独立
transport、pending owner 和 receiver 消费者，不扩旧 class3 receiver，不复制完整
129 行 dialog，不引入新的 generic backend UI flow。

UI 状态机要求：

- owner 身份来自 `GameConnection` 的真实认证结果与连接世代；显式登录和
  `ensureConnected` 自动认证同源。发送 `ValuableItemSale` 前先完成真实连接准备并核对
  捕获身份；身份或世代变化时拒绝旧请求，并使旧 QUERY、confirmed projection 与 pending
  不能写入新账户。跨页共享 token 由 A 变为 B 后自动重连，不能把 A 的 pending 发到 B。
- 行双击或 Enter 使用 `activation {instanceId, sequence}`；同一 `sequence` 只处理一次。
- 打开前先 QUERY `ValuableItemSale`，只允许 quote 中 exact ID 且 `canSell` 的实例。
- 数量输入只接受整数 `1..min(ownedQuantity,0xffffff)`；单价恒 `0`。
- 真正的新出售按当前 quote 与数量门禁创建请求。已发送但结果不确定的 pending 使用保存的
  `instanceId/quantity/requestId` 单独确认；即使当前剩余不足原数量、原行已经删除，也按原
  requestId 重放并消费历史 sold 与当前投影，不以当前 quote、剩余量或行存在阻止确认。
- 确认成功或服务端明确未成交后释放 pending。关闭数量弹窗或取消不丢未确定请求；同
  instance/quantity 的 busy 重复确认不派发第二次请求。
- 成功只安装返回的完整 inventory、money、profile 与新 quotes，刷新当前 Home；不得先
  乐观减 count 或先乐观改 wallet。零价出售不改钱包数值。
- 成功收据必须是 `sold.result===2`，且 instance/quantity 与请求一致；否则仍视为未确认。
- 部分出售后列表行按服务器 count 更新；完全出售后行移除、弹窗关闭。
- 沿现 `battle.matchPanel` 订阅 room/round/stage；转换时使 query/sale 显示世代失效、
  关闭数量弹窗并释放页面 lock。同 owner 的未确定 pending 保留；转到不允许阶段不发新
  `SELL`，回到可售阶段后再按原编号确认。普通 Inventory 刷新沿用同一确认 authority，
  迟到响应不能覆盖当前 confirmed projection。
- 取消、切换 weapon/item/valuable tab、关闭 Home、连接变化以及旧 query/sale generation
  的晚返回都不得写入；连接变化同时清理旧账户的显示状态。
- 数量确认复用原 `userinput_dialog.xml` 的 9 项控制。共享 dialog 的根 class/CSS 同时覆盖
  kind3 与 kind5，保留零 padding、无浏览器默认 border/背景、原字体与 overflow；两类出售
  的 RPC、pending owner 和 receiver 保持独立。
- 失败状态走现有 `SourceFeedbackText`；不把失败当成功、不更新余额或库存。

## 限制

原 Windows 服务端 dispatcher、完整 battle 实测、持久重启实测和原 receiver 未命名字段
仍未取得。现有实现只固定可在当前 source 链实施的 server/shared/UI 终态；已有 M5-09 /
UI36 / UI65 / M6-06 父项及新增 M6-06-VSALE 子项保持未勾。
