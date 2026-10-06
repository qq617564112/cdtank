# 账户支出统计运行合同

`apps/server/src/accounts/spending.ts` 提供真实已提交 money/token 支出的最小账本。它只累计调用方已经确认的交易金额，不使用余额差、奖励转入、退款或当前目录价格反推历史付款。

## 正式导出

```ts
initializeAccountSpending(database: DatabaseSync): void
recordAccountSpending(database: DatabaseSync, accountId: string, source: string,
  receiptId: string, money: number, tokens: number): void
readAccountSpending(database: DatabaseSync, accountId: string): {
  spentMoney?: number; spentTokens?: number;
}
```

初始化只执行普通 `CREATE TABLE IF NOT EXISTS account_spending_ledger`，列保存 `account_id/source/receipt_id/money/tokens` 并以 `(account_id, source, receipt_id)` 为 exactly-once key。没有迁移框架、新 HTTP 接口或旧收据回填。

## 事务边界

每个 purchase/maintenance 生产者在自己的既有 `BEGIN IMMEDIATE` 事务内，先验证并写入原业务 receipt，再写支出账本，最后 `COMMIT`。同一 `(account_id, source, receipt_id)` 的重放命中原 receipt 后直接返回，不重复记账；任何后续写入或提交失败都由原 `catch` 执行 `ROLLBACK`，业务状态与支出账本一起回滚。

Trade 在双方原 `trade_receipts` 写入的同一事务内按账户分别记录各自 outgoing money。收到金钱不是支出，originality/skillPoints 不记入 tokens。实际金额为0但请求已经成功执行时仍写入真实 receipt，`readAccountSpending` 返回已记录窗口的0而不是 unknown。

## 捕获范围

| source | 实际金额 |
| --- | --- |
| `shop` | 当前实际查询到的单价乘以数量；`MONEY` 或 `TOKENS` |
| `tank-shop` | 当前目录实际成交 `moneyPrice` |
| `pet-shop` | 当前目录实际成交 `moneyPrice` |
| `part-maintenance` | 当前报价实际 `quote.cost`；原 `currency=0` 为 tokens，`1` 为 money |
| `tank-maintenance` | 当前报价实际 `quote.cost`；原 `currency=0` 为 tokens，`1` 为 money |
| `trade` | 本账户 outgoing money；`money=0` 也记录 |

`readAccountSpending` 仅在该账户存在至少一条账本 receipt 时返回求和。没有账本记录时两个字段均为 `undefined`，表示未知而非0；已有记录时只返回本账本捕获窗口内的实际金额。

旧 `shop_purchases`、`tank_purchases`、`pet_purchases`、`part_maintenance`、`tank_maintenance` 和 `trade_receipts` 没有稳定冻结原付款额。此处不回填这些旧 receipt，也不根据当前 catalog 价格推断旧成交额；原历史支出保持 unknown，本账本只声明从接入后成功提交的交易开始捕获。

战车迷彩的真实扣费由 `AccountStore.configureTankTextures` 在其既有事务内调用同一账本记录；技能点学习和出售/退款不是 money/token 支出。

## 未执行

本批未运行 unit test、浏览器、build、typecheck、lint、exporter、native/evidence 脚本或自动验收；真实网络交易、服务重启和跨模块消费者接入留给后续集中验证。
