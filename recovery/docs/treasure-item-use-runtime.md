# 鱼骨/骨头普通使用运行时

实现任务 FUNC-20/skill30005 的类别 6 贵重品持久拾取后的真实普通使用链。范围只限
item20001 鱼骨、item20002 骨头；不开放整类别，不新增 schema、UI 或账户成长。

## 来源事实

- item20001/20002 类别 6、`ItemType=13`，`ItemMoney/ItemCoin/GGet/Durable=0`，
  `BattleUseMax=0`，`ItemSkill1` 分别为 skill20001/20002，`ItemSkill2` 同为 skill30005。
- skill20001/20002 为 `Trigger1/Target1`，Func20 首槽参数 `T1/X1/Y20001/Z0` 与
  `T2/X1/Y20002/Z0`，Effect/Sound 全 0，作用是该贵重品数量加一。
- skill30005 为 `Trigger1/Target1`，Func2，`HP=30`，Effect11/GA15。item 文案写“恢复15点”
  与技能字段不一致，本文按技能字段 `HP30` 作为普通自用治疗量，文案保持字面描述。
- 原 `UMsgPickupTreasure` 成功合同只清理场景物件，不写 owned 数量。真实 ground 取得事务在
  `ground-items.ts`/`accounts/ground-items.ts` 落类别 6 持久数量加一，是唯一数量写入者。

## 采用规则

- 数量初始化：item20001/20002 原表 `BattleUseMax=0`。采用入口对这两个已配置实例按真实
  `ownedQuantity` 初始化本局可用数，`initializeBattleQuantities`、拾取入账与
  `reconcileGroundItemInventory` 使用同一规则，不发明 10/99 等每局上限，也不把它称为原行为。
  未配置实例仍为 0。其它物品继续 `max(0, min(owned, BattleUseMax - roundUse))`。
- 快捷槽资格：沿用 `resolveItemHotkey` 七槽解析与 `requestKitbagAssignment` 的类别 6 配置
  范围（`1..4000` 或 `20001..21000`）。只有已配置到槽、本局可用数非零的两个物品才走新入口；
  原分类 1/2 的 `requestItemUse` 判据不改，整类别 6 不因此开放。
- 普通使用：`dispatchItemHotkey` 命中 item20001/20002 时经 `requestTreasureItemUse` 发普通
  `useItem` 请求，随后 `applyTreasureItemUse` 校验存活 `status===2`、自用、缺失生命与
  skill30005 真实定义。成功先经持久 `consumeItem` CAS 扣一份 owned，再按 skill30005 的
  `HP30`（含 `attributesReady` 时现有 `0x8c` 治疗资格）治疗并 clamp 到当前玩法上限，最后发
  一次 itemUsed 与源技能通知，双量各减一。
- 拒绝与失败：非存活/未配置/零量/满血/最后一搏/账户失配/存储异常都不改 HP、不扣量、不发
  假成功。重复输入由现有 sequence 水位拒绝。owned 归零由持久层清实例与快捷槽。
- Func20 不在此入口执行加一。普通消费不再复制拾取授予，避免净加一；拾取仍是唯一数量授予。

## 接入口

- `apps/shared/combat/treasure-items.ts`：两个物品身份与判定。
- `apps/server/src/battle/items/treasure-item-use.ts`：`requestTreasureItemUse`、
  `applyTreasureItemUse`。
- `apps/shared/combat/item-hotkeys.ts`：`initializeBattleQuantities` 对两物品按 owned 初始化。
- `apps/server/src/battle/items/item-request-dispatch.ts`、`battle/accept-input.ts`：普通七槽
  请求与权威施放接线。
- `apps/server/src/battle/items/ground-items.ts`、`accounts/ground-items.ts`：拾取/reconcile
  对两物品同步真实 owned 可用数。
- `apps/server/src/battle/cpu/items.ts`、`battle/cpu/controller.ts`：CPU 有限真实库存沿同一
  普通输入在缺失生命时自用，不赠送物品。

## 验证边界

本文记录静态实现与来源/采用规则，不声称 tests、浏览器、build、typecheck、lint、原生导出或
持久化实测已经通过。已扣 owned 不再叠加 roundUse 的取用规则为 root 授权采用，非原行为。
