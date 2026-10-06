# 账户统计与九奖章运行

`apps/server/src/accounts/statistics.ts` 从既有 `match_history` 聚合账户查询；统计不另开结算入口，
也不复制一份可由 `ResultPlayer.roundStats/awards` 推导的计数表。`AccountStore` 在构造时初始化
spending 账本，`RoleProfile` 普通查询在原有 `profile/playerSummary/growth/titles` 上附
`statistics` 与真实奖项记录存在时的 `awards`；`selectTitleId` 请求仍只执行称号选择授权与跨连接
badge 刷新，不因查询或选择追加授予。

## 查询窗口

| 输出 | 覆盖窗口 | 缺失边界 |
| --- | --- | --- |
| `wins/losses/draws/kills/deaths` | 该账户全部 `match_history` 记录 | 无旧字段缺失，均来自冻结 `ResultPlayer` |
| `winStreak/loseStreak` | 全部记录按 `ended_at, match_id, round` 升序的最大连续段 | 不依赖 optional 统计 |
| `battleSeconds` | `account_title_playtime` 每 `(account,match,round)` 的真实冻结秒数 | 旧 history 无秒行时不补地图 `timeLimit` |
| `shots/hits/damage/killCombo` | 至少一条记录带真实 `roundStats` 时，汇总这些已记录记录 | 无 producer 行时不出现；有 legacy 缺项时不把缺项当 0 |
| `spentMoney/spentTokens` | `account_spending_ledger` 已 COMMIT 的真实金额收据 | 无收据时不出现；不从当前 catalog 或余额差回推旧消费 |
| `awards` | 至少一条记录带真实 `awards` 时的九项完整计数 | 无 producer 行时不出现；旧行缺 awards 时不冒充零次 |

`roundStats` 四字段是已记录窗口的累计值，`killCombo` 是该窗口最大值。它们对“大于阈值”条件是
保守下界，但涉及 `shots/hits` 的比例条件只在所有 history 行都有 `roundStats` 时求值；否则
`readTitleStats` 把窗口标为非完整，ratio 条件不授予。任一合法 `awards` 数组（包括本局零奖章）
都算一条真实 producer 记录；任一旧行缺 awards 时，奖项累计仍可作为保守下界使用，但“某奖项
少于阈值”的条件不授予，避免把未知旧次数当 0。

## 事务与幂等

`World` 冻结的 `ResultPlayer.roundStats/awards` 经现有
`AccountHistory.record` 写入 `settled_matches`/`match_history`。写历史行后在同一个
`BEGIN IMMEDIATE` 内调用 `AccountTitle.grant`；后者用 `readTitleStats` 读取刚插入的同账户行，
因此统计、九奖章与称号一次 COMMIT。任一步抛错整体 `ROLLBACK`，`settled_matches` 不留假成功。

重复 finish、queue retry、重启后再报时命中既有 `(match_id, round)` 门直接返回，不再写 history、
统计或称号。同一账户多连接参加同场由 `settlement/history.ts` 合并为一份 participant；
CPU 和无账户玩家不进入 `AccountHistory.record`，因此没有账户写。

战车迷彩 `decision.send === 3` 时，`AccountStore.configureTankTextures` 在原迷彩/资料更新的同一
事务内按真实 `decision.moneyCost/tokenCost` 写入一个新的 `tank-texture` UUID 收据；无变化或
请求未发送不记。其它真实消费收据由 `accounts/spending.ts` 的生产者写入同一账本，读侧仅汇总
已 COMMIT 的显式金额，不把出售、转入、技能点学习、创意点或代币奖励混入。

## 称号条件

`settlement/title.ts` 的 selector 1–23 均由本 batch 的真实 producer 接入，`conditionAvailable`
反映生产已接。149–151 按原说明拆为 money，152–154 拆为 tokens；这是说明文本对应的采用规则，
不把两类花费复制成同一个 selector 13。`FunctionType 2` 继续使用现有 domain 的 `a/b/c` 单位。
type 8/9 只读取真实九项完整计数，type 10 与 158 号固定点继续按真实永久 owned 集合迭代。

## 未执行

本文件记录实现，不代表真实网络、双网页、HD、持久/重启、CPU 隔离或原 producer 验收已执行。
本批未运行 unit test、浏览器、build、type check、lint、exporter/native/生成器或自动验收。
