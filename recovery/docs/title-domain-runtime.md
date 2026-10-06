# 称号 domain 运行合同

`apps/server/src/settlement/title.ts` 是从原 `title.dat` 生成称号目录并评估授予的深模块。它只接受已经权威冻结的 lifetime stats，不依赖 World 可变态，也不写数据库；持久化接线由后续 server worker 在同一结算事务内完成。

## 正式接口

| 导出 | 合同 |
| --- | --- |
| `TITLE_TABLE` | `apps/server/src/config.ts` 的既有 `readTable('title')` 结果，字段原样为 `称号ID/称号名称/说明/FunctionType/FunctionX/FunctionY/FunctionZ/a/b/c`。 |
| `TitleTableRow` | `Readonly<Record<string, string>>`，供后续 worker 传入同一目录行。 |
| `TitleStats` | 必须字段：`wins/losses/draws/winStreak/loseStreak/kills/deaths/battleSeconds`。可选且仍缺 producer：`hits/shots/damage/killCombo/spentMoney/spentTokens/awardCounts`。 |
| `AwardKind` | `perfect/mvp/savage/console/brave/kind/crafty/shy/greedy`，对应 selector 15–23。 |
| `TitleDefinition` | `id/name/description/condition/conditionAvailable`；158 条全部存在，不删缺 producer 行。 |
| `readTitleDefinitions(rows?)` | 从 `TITLE_TABLE` 或同形状行生成完整目录；不复制第二份名称表。 |
| `TITLE_DEFINITIONS` | 已解析的完整 158 条 catalog。 |
| `evaluateTitleGrants(stats, ownedIds)` | 返回本次真实可授予且未拥有的 `title_id[]`，顺序稳定。 |

## 条件实现

| 类型 | 真实判定 |
| --- | --- |
| 1 | `stat(X) > a` |
| 2 | `stat(X) > a && stat(X)*100 > stat(Z)*b`；`c` 原样随定义保留但不参与判定，因为 158 行全为 `c=0`。 |
| 5 | `stat(X)+stat(Y) < a && stat(Z) > b` |
| 6 | `stat(X) > a && stat(Y) < b` |
| 7 | `stat(X) > a && stat(Y) > b` |
| 8 | 九个 awards 的计数全部存在时，`max >= a` |
| 9 | 九个 awards 的计数全部存在时，`min >= a` |
| 10 | `owned+newGrants > a` |

`conditionAvailable` 是给后续 producer/UI 的可用性标记；evaluator 仍按真实 stats 判定，缺少的 stats 为 `undefined`，不能按 0 处理。`hits` 缺失不会令“击毁数”条件失效；selector 13 按原列映射 `spentMoney`，selector 14 映射 `spentTokens`，当前目录没有 14 行。

## 158 号固定点

`evaluateTitleGrants` 从真实 `ownedIds` 出发，每轮加入真实可判定的新 ID，并以当前 owned+granted 数重新检查 158。循环至固定点后返回本轮新增。这样真实 56 条基础累计加其他已获得称号达到 51 条时能授予 158，而不是因奖项/命中/伤害/花费 producer 后续才实现而永久关闭。

## 数据来源边界

`readTitleDefinitions` 直接读取 `TITLE_TABLE`；原 JSON 已发布，不运行 exporter。当前 runtime snapshot 尚未包含 `m_iNowTitle` wire 消费者，`recovery/evidence/roles/role-numeric-property.ts` 只证明 index 2 的 type14/record `+0x14` 编码，不作为已接线事实。

后续接线顺序：

1. server worker：从 `ResultPlayer` 与冻结 `startedAt/endedAt` 累计 typed stats；在 `AccountHistory.record` 同一事务写入 grant 和 selection。
2. shared worker：在现有 `PtlRoleProfile`、`PtlLobbyPlayers`、`PtlFriends`、`PtlBlacklist`、`MsgRoomSnapshot` 上加最小可选 typed title 字段，保留 raw 字段不变。profile 返回 `AccountTitles {owned: OwnedTitle[]; selectedTitleId: number}`，请求用 `selectTitleId?: number`；快照用 `PlayerSnapshot.title?: PlayerTitle`，正常 other player info 用对应的 `title?: PlayerTitle` 记录字段。
3. Web worker：Home/他人资料/HUD 只消费权威字段，缺失保持空白。

## 未执行

此文件记录实现合同，不代表持久化、网络、真实账户、两网页、HD、构建或测试已执行。当前未运行 unit test、浏览器、build、typecheck、lint、exporter/native/生成器或自动验收。
