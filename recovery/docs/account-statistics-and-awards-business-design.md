# 账户统计与九奖章正式业务设计（M6-05 / M2-11 剩余统计与奖项）

本文在缺原服务器程序的前提下，从已发布 `title.dat`/`m001..m005.dat` 列、源客户端结果/奖项显示与既有真实战斗、结算、账户事务链，给出可直接接线的统计与九奖章业务规则。原事实与采用规则分列；未取得原 producer 的字段用明确采用政策补齐，绝不写成原事实，也不从缺失 raw 字段（含字段0）造奖。奖励货币本身不在本文范围，仍由 M6-02 `settlement/reward.ts` 负责。

依赖既有 `World.finishRoom → settlement/history.accountMatchHistory → AccountStore.recordMatchHistory → accounts/history.record` 同一 SQLite 事务；统计与奖项复用 `settled_matches(match_id,round)`/`match_history(account_id,match_id,round)`/`account_reward_ledger` 的 exactly-once 门，不新增独立结算入口。

## 交付范围

- 真实 producer：`shots`、`hits`、`damage`（含真实 HP 减少的异常/场景路径归属）、`killCombo`、`spentMoney`、`spentTokens`。
- 九奖章 `Perfect/MVP/Savage/Console/Brave/Kind/Crafty/Shy/Greedy` 的判定与每局冻结、账户累计。
- 依赖这些统计的 `title.dat` 剩余称号（命中/发射/伤害/连杀/奖项/花费）与 `m00x` 九奖章 `FunctionType 8/9/10` 正式 producer。
- 本机 Home 战绩统计、Home 九奖章计数、`game_summary` 每局奖章图标三个显示消费者接权威数据。

不关闭：原 `game_summary.xml` 185 控件 1:1、原 Windows 对照、完整字体/像素、原奖章图标选取事件的 1:1 还原。

## 原来源事实

| 范围 | 原来源事实（已发布可读） |
| --- | --- |
| 称号表 | `CDTank/Data/table/title.dat` 实读 158 行，列 `称号ID/称号名称/说明/FunctionType/FunctionX/FunctionY/FunctionZ/a/b/c`（`recovery/output/verified/tables/title.csv`）。 |
| 统计选择器 | `FunctionX/Y/Z`：1 获胜、2 失败、3 打和、4 连胜、5 连败、6 战斗总时间(秒)、7 击毁、8 被击毁、9 发射总数、10 命中总数、11 连续击毁、12 造成伤害总数、13 花费总数、15 完美、16 优秀(MVP)、17 残酷(Savage)、18 悲情(Console)、19 勇猛(Brave)、20 慈悲(Kind)、21 狡猾(Crafty)、22 腼腆(Shy)、23 贪婪(Greedy)。 |
| 九奖章列 | `m001.dat`–`m005.dat` 实读 26 行组合，每行含 `Perfect/PerfectScore`、`MVP/MVPScore`、`Savage/SavageDamage/SavageDamagePlus/SavageScore`、`Console/ConsoleDamage/ConsoleDamagePlus/ConsoleScore`、`Brave/BraveScore`、`Kind/KindDamage/KindDamagePlus/KindScore`、`Crafty/CraftyDamage/CraftyDamagePlus/CraftyScore`、`Shy/ShyScore`、`Greedy/GreedyScore`（列序见 `recovery/output/verified/tables/m00*.json`）。`datascale.dat` 无奖章行，只有胜负/平局的金钱/星币/技能点/创意点百分比（ID 31–42），不是奖章来源。 |
| 奖章标志 | 26 行实际值：`Perfect/MVP/Savage/Console/Brave/Kind/Crafty/Shy/Greedy` 全部为 1（该模式启用），无 0 行；`SavageDamage=200`、`ConsoleDamage=100`、`KindDamage=100`（模式4为50）、`CraftyDamage=100`（模式4为50）及其 `DamagePlus` 为原始列值。 |
| 结果奖励显示 | `result-reward-display-native.json`：回调 `0x4ac736` 读取本局结果消息 `+c0→txtMoney/+c4→txtCoin/+c8→txtOriginality/+cc→txtTech`，signed int32 `%d` 直接显示；与本机 `ResultPlayer.award` 一一对应。 |
| 普通射击链 | 源 4288fe 自由瞄准分支即时调用 423956→489ba8（item2001→skill4020→Effect7/SE30）；玩家实体命中链为本机/远端 3aa3 到 424614，trigger8 经 4886aa 提交受害者 selector。现 Web 对应 `apps/server/src/battle/actors.ts` 的 `beforeFire`→`fireProjectile` 与 `apps/server/src/world.ts` 的 `resolveShotPlayerHit`→`applyPlayerDamage`。 |
| 射击结果字段 | `apps/shared/protocols/MsgRoomEvent.ts`：`hit` 事件携带真实 `value`(damage) 与可选 `shotPlayerResult:{itemId,critical}`；另有 `friendlyFire`/`immuneHit` 不减少 HP。免伤/抵消/友伤当前走独立分支，不产生真实 HP 减少。 |
| 结算链 | `World.finishRoom`（world.ts:726）冻结 `ResultPlayer{team,rank,name,kills,deaths,objectivesDestroyed,combatScore,outcomeBonus,totalScore,outcome}`；`settlement/history.ts:accountMatchHistory.committed` 按账户去重后交给 `accounts/history.record` 的 `BEGIN IMMEDIATE`，经 `RewardGrant` 在同一事务内写奖励。 |
| 消费收据表 | `shop_purchases`、`tank_purchases`、`pet_purchases`、`part_maintenance`、`tank_maintenance`、`trade_receipts`，均以 `(account_id,request_id)` 或 `session_id` 主键；出售/退款在独立的 `stack_item_sales/part_sales/owned_role_sales`。 |
| 账户字段 | `role_profiles`：金钱 `0x70`、星币 `0x74`、积分 `0x5c`、原始 `0x9c`、技能点 `0xa0`；Home 统计/奖章控件来自 `myhome_playerpage_battlesummary.xml`/`myhome_playerpage_awardsummary.xml`，结算奖章格来自 `game_summary.xml` 的 `picCatAward{i}_{0..4}/picDogAward{i}_{0..4}`（每队每玩家5格，共60控件）。 |
| 缺失 | 原服务器奖章判定 writer、`shots/hits/damage/killCombo/spend` writer、原奖章图标选取事件与 `m00x` 原始消费点均未取得。 |

## 采用规则

以下条件均由本局/本账户真实可算数据判定，选择明确且可逆；不冒称原判定等价。

### 真实 producer 归属

| 统计 | 真实边界（采用） | 计入 / 不计入 |
| --- | --- | --- |
| `shots` | `apps/server/src/battle/actors.ts` `advanceActors` 中 `handlers.beforeFire` 返回真、`fireProjectile` 之前的同一接受点。 | 只计普通 2001 接受开火一次；装填未就绪、弹匣/库存 CAS 拒绝、`beforeFire` 拒绝、选弹/技能施放不计。 |
| `hits` | `apps/server/src/world.ts` `resolveShotPlayerHit`：普通接受射击真实命中敌方角色且 `hpAfter < hpBefore`。 | 一次接受射击对一个真实敌方角色计一次；免疫 `immuneHit`、抵消、友伤（不减少 HP）不计；DoT/burn、空袭、地雷、直接技能不冒充普通命中，不计入 `hits`。 |
| `damage` | `apps/server/src/world.ts` `applyPlayerDamage` 与直接伤害入口 `hitGroundSkill`（旧炸弹/空袭/地雷→`damagePlayerDirectly`）：按 `hpBefore-hpAfter` 的真实 HP 减少累加。 | 计对敌方角色的真实 HP 减少，含普通射击、burn、空袭、地雷、直接技能；友伤、免伤、抵消、场景物件/目标破坏不计（非角色 HP）。受击方 `damageTaken` 同步累加。 |
| `killCombo` | `apps/server/src/world.ts` `commitPlayerDeath` 在敌方角色被真实击毁时对攻击者递增当前连段并更新本局最大；被击毁玩家自身连段清零。 | 只在真实击毁（`finalizePlayerDeath` 已递增 `attacker.kills` 的敌方）递增；友伤击毁不增；玩家自身死亡清零；`startRoom` 新 round 初始化清零。 |
| `spentMoney`/`spentTokens` | 结算时对已 COMMIT 的 `shop_purchases`/`tank_purchases`/`pet_purchases`/`part_maintenance`/`tank_maintenance`/`trade_receipts` 求和，按原表价格或收据 `cost`/`offers.money` 还原实际支付。 | 买与数量按原价（`unitPrice×quantity`）算实际支付，不是余额差；出售/退款（`*_sales`）、失败回滚、未 COMMIT 请求不计；同 `(account_id,request_id)` 重放是主键 replay、不新增行，不重复计。宠物技能学习用技能点(`0x80`)不是金钱/星币，不计；战车迷彩无请求收据表，暂不计入。交易只贡献给方 `offers.money`（金钱），星币不在交易报价内。 |

### 九奖章采用条件

`score` 恒为该地图行的 `*Score` 列字面值作为本局加分（不是达成阈值）；`*Damage`/`*DamagePlus` 才是阈值列。奖章判定按冻结的本局 `RoundStats` 与冻结结果计算，每局每人每类型至多一次。

| 奖章 | 采用条件（本局真实判定） | 唯一性 / tie | 模式资格 |
| --- | --- | --- | --- |
| Perfect | `deaths==0` 且 `kills+objectivesDestroyed>=1` | 达标者都可获得 | 该行 `Perfect==1` |
| MVP | 本局最高 `totalScore` | 每队1名（mode1–3），mode4/5全局1名；平手依次比 `kills`、`objectivesDestroyed`、较小 `playerId` | 该行 `MVP==1` |
| Savage | `damage>=SavageDamage`（含 `DamagePlus` 阶梯只影响列值，不额外多发） | 达标者都可获得 | 该行 `Savage==1` |
| Console | `damageTaken>=ConsoleDamage` 且 `deaths>=1` | 达标者都可获得 | 该行 `Console==1` |
| Brave | `deaths>=1` 且 `kills>=1`（阵亡前有击毁） | 达标者都可获得 | 该行 `Brave==1` |
| Kind | mode≤3 且 `kills==0` 且 `friendlyFireDamage==0` | 达标者都可获得 | 该行 `Kind==1` |
| Crafty | `deaths==0` 且 `damageTaken>=CraftyDamage` | 达标者都可获得 | 该行 `Crafty==1` |
| Shy | `shots==0`（本局未发射） | 达标者都可获得 | 该行 `Shy==1` |
| Greedy | 本局最高 `damage` | mode4/5全局1名；平手比 `kills`、较小 `playerId` | 该行 `Greedy==1` |

规则说明：

1. `awards[].score` 求和后加入该玩家本局 `combatScore`（一次性冻结），随既有 `totalScore`/reward 链走；不改变 `outcomeBonus` 语义。`coin` 仍无基础授权保持 0。
2. 奖章是**本局成就**、计入账户累计次数；不是默认赠送，不是胜负/击杀冒充。CPU 与旁观无 accountId 不写账户。
3. 只有该地图行对应标志为 1 才判定该奖章；标志为 0 不判定。

### 称号补齐采用

新增 producer 后，`title.dat` 剩余条件按既有 `FunctionType` 逐条判定（表列值为准，`说明` 文本仅参考）：

- `FunctionType 2`（36–41）：`hits/shots` 命中率 `X*100 > Z*b`，`X` 为命中/发射选择器。
- `FunctionType 1/6/7` 涉及 `damage`（68–72）、`hits`（145–148）、`killCombo`（42–46）：按新增累计列判定。
- 花费（149–154）：`spent_money`/`spent_tokens` 按 `说明` 的金钱/代币分别映射到选择器 13 的两个 typed 列；同选择器不再混用。
- 奖项（73–144、155）：选择器 15–23 读 `account_award_stats` 九计数。
- `156 一技之长`（`FunctionType 8`）= `max(awardCounts)>=a`；`157 大满贯`（`FunctionType 9`）= `min(awardCounts)>=a`；`158 奇货可居`（`FunctionType 10`）= `ownedTitleCount>a`，`ownedTitleCount` 取 `account_titles` 实际行数。
- 任一所需统计未产出/为未知时该称号不授予；不因缺字段0填默认值造奖，不新增取数 API/poll。

## 最小共享合同

只扩既有 `MsgRoomSnapshot`/`PtlRoleProfile`/`PtlHistory` 可选字段，不新增 API、不新增 poll。

```ts
// apps/shared/protocols/MsgRoomSnapshot.ts
export type AwardType = 'perfect' | 'mvp' | 'savage' | 'console' | 'brave'
  | 'kind' | 'crafty' | 'shy' | 'greedy';

export interface RoundStats {
  shots: number; hits: number; damage: number; damageTaken: number;
  killCombo: number;            // 本局最大连续击毁
  friendlyFireDamage: number;
}

export interface RoundAward {type: AwardType; score: number;}

export interface ResultPlayer {
  /* 既有字段不变 */
  roundStats?: RoundStats;
  awards?: RoundAward[];
  award?: ResultAward;          // 既有本局货币/成长 receipt
  awardCounts?: Partial<Record<AwardType, number>>;  // 本局九奖章各计1
}
```

```ts
// apps/shared/protocols/PtlRoleProfile.ts
export interface AccountStatistics extends RoundStats {
  wins: number; losses: number; draws: number;
  winStreak: number; loseStreak: number; battleSeconds: number;
  kills: number; deaths: number;
  spentMoney: number; spentTokens: number;
}
export interface ResRoleProfile {
  /* 既有 playerSummary/profile/growth/titles 不变 */
  statistics?: AccountStatistics;
  awards?: Partial<Record<AwardType, number>>;
}
```

`PtlHistory.MatchHistoryRecord.result` 复用同一 `ResultPlayer`，因此 `roundStats/awards` 随战绩查询免费返回，Home 统计消费者无需新请求。

## 持久结构

沿既有 `AccountStore`/`AccountHistory` 的 SQLite，用项目正常 `CREATE TABLE IF NOT EXISTS`，不建 migration/feature flag/hash。`account_title_stats`/`account_titles`/`account_title_selection` 沿用 title-client-business-design 定义的表（该批尚未接线时首次创建），保留主键与 exactly-once 语义，并新增明确类型列：

```sql
ALTER TABLE account_title_stats ADD COLUMN shots INTEGER NOT NULL DEFAULT 0;
ALTER TABLE account_title_stats ADD COLUMN hits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE account_title_stats ADD COLUMN damage INTEGER NOT NULL DEFAULT 0;
ALTER TABLE account_title_stats ADD COLUMN kill_combo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE account_title_stats ADD COLUMN spent_money INTEGER NOT NULL DEFAULT 0;
ALTER TABLE account_title_stats ADD COLUMN spent_tokens INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS account_award_stats (
  account_id TEXT PRIMARY KEY,
  perfect INTEGER NOT NULL DEFAULT 0, mvp INTEGER NOT NULL DEFAULT 0,
  savage INTEGER NOT NULL DEFAULT 0, console INTEGER NOT NULL DEFAULT 0,
  brave INTEGER NOT NULL DEFAULT 0, kind INTEGER NOT NULL DEFAULT 0,
  crafty INTEGER NOT NULL DEFAULT 0, shy INTEGER NOT NULL DEFAULT 0,
  greedy INTEGER NOT NULL DEFAULT 0);
```

`account_title_stats`/`account_award_stats` 由统计/称号模块拥有；`rank_points/level/originality/tech` 仍归 M6-02 `account_growth`，两表互不覆写。新增列只承载真实 producer；未产出字段保持默认且不参与授予。

## 最小接口

| 接口 | 归属 | 责任 |
| --- | --- | --- |
| `actorHandlers.onAcceptedShot?()` | battle | `advanceActors` 在 `beforeFire` 通过后、`fireProjectile` 前调用；World 累加 `shots`。 |
| `recordRoundDamage(owner,target,beforeHp)` | battle | 单一 HP 差分累加点，用于 `applyPlayerDamage` 与直接伤害入口；`hits` 仅由 `resolveShotPlayerHit` 在真实命中时追加。 |
| `settleAwards(mapRow, players)` | battle（新 `settlement/awards.ts` 纯函数） | 依上表返回每人 `RoundAward[]`；不依赖 World 可变态。 |
| `AccountStatistics.applyMatch(accountId, result, match)` | account（新 `accounts/statistics.ts`） | 在既有 `BEGIN IMMEDIATE` 内用冻结 `RoundStats/RoundAward` 累加 `account_title_stats`/`account_award_stats`；同 `(account,match,round)` 由 `settled_matches` 门保证一次。 |
| `AccountStatistics.spending(accountId, catalogs)` | account | 读既有消费收据表求和；纯查询，不新增购买 hook。 |
| `evaluateTitleGrants(defs, stats, awards, ownedCount)` | account（新 `settlement/title.ts`） | 同事务内评估并插入 `account_titles`；缺统计不授予。 |

## 按文件实施归属

### Lane A：battle perroundstats + award frozen receipt

| 文件 | 改动 |
| --- | --- |
| `apps/shared/protocols/MsgRoomSnapshot.ts` | 新增 `AwardType/RoundStats/RoundAward` 与 `ResultPlayer.roundStats/awards/awardCounts?` 可选字段。 |
| `apps/server/src/battle/player-state.ts` | `PlayerState.roundStats` 初始化；`startRoom` 每 round 清零。 |
| `apps/server/src/battle/actors.ts` | 新增 `onAcceptedShot` 边界调用，唯一 `shots++` 点。 |
| `apps/server/src/world.ts` | `beforeFire`/新 handler 累加 `shots`；`resolveShotPlayerHit` 在真实 HP 减少时 `hits++`；`applyPlayerDamage`/`hitGroundSkill`/burn/airstrike 按 HP 差分累加 `damage`/`damageTaken`；`commitPlayerDeath` 维护 `killCombo` 与死亡清零。 |
| `apps/server/src/settlement/awards.ts`（新） | 纯函数 `settleAwards`；`*Score` 作为加分，`*Damage` 作为阈值。 |
| `apps/server/src/settlement/match-result.ts` | 冻结时写入每人 `roundStats`、`awards`、`awardCounts`，并把奖章分并入 `combatScore`。 |

### Lane B：account ledger stats/spending aggregation

| 文件 | 改动 |
| --- | --- |
| `apps/shared/protocols/PtlRoleProfile.ts` | 新增 `AccountStatistics` 与 `ResRoleProfile.statistics/awards?`。 |
| `apps/shared/protocols/PtlHistory.ts` | 复用 `ResultPlayer`，无需新字段。 |
| `apps/server/src/accounts/statistics.ts`（新） | `account_title_stats`/`account_award_stats` upsert、`spending` 只读聚合、`readStatistics`。 |
| `apps/server/src/account-store.ts` | 薄转发 `recordAccountStatistics`/`accountStatistics`/`accountAwardCounts`，不堆业务。 |
| `apps/server/src/accounts/history.ts` | `RewardGrant` 同事务扩展为统计/奖项/称号一次写；仍由 `settled_matches`+`match_history` 主键 exactly-once。 |
| `apps/server/src/settlement/history.ts` | `accountMatchHistory.committed` 把冻结 `result.roundStats/awards` 一并交给账户事务；retry/departed/same-account 语义沿 k1006。 |
| `apps/server/src/settlement/title.ts`（新） | `decodeTitlePredicate`/`evaluateTitleGrants`；读统计+九计数+`account_titles` 行数。 |
| `apps/server/src/accounts/title.ts`（新） | `account_title_stats` 更新、`account_titles` 幂等插入、`account_title_selection` 保持。 |
| `apps/server/src/accounts/api.ts` | `RoleProfile` 回包在既有 profile/growth/titles 上附 `statistics/awards`；不新增 API。 |

### Lane C：dedicated UI 原奖章和统计显示

| 文件 | 改动 |
| --- | --- |
| `apps/web/src/interface/home/home-award-summary-source-page.tsx` | 九个 `txt{Perfect,MVP,Savage,Console,Brave,Kind,Crafty,Shy,Greedy}` 绑 `ResRoleProfile.awards` 计数；缺数据保持空白，不填零/模板。 |
| `apps/web/src/interface/home/home-battle-summary-source-page.tsx` | `txtHitCount/txtShootCount/txtTotalDamage/txtMaxComboCount/txtComboWinCount/txtComboLoseCount/txtTotalDays/txtTotalTime/txtHitRate` 绑 `ResRoleProfile.statistics`（无则保留现有 History 五字段）。 |
| `apps/web/src/interface/battle/battle-summary-page.tsx` | 每玩家 `picCatAward{i}_{0..4}/picDogAward{i}_{0..4}` 按本局 `ResultPlayer.awards` 取前5个类型点亮对应图标；无 `awards` 保持空白，不点亮无 producer 奖章。 |
| `apps/web/src/interface/battle/battle-summary-award-page.tsx` | 已消费 `local.award`；保持不改。 |
| title 显示消费者（`home-player-source-page.tsx` 等） | 沿既有 `m_iNowTitle`/`titles` 方案，缺数据空白。 |

## 事务、幂等与边界

- 统计/奖项/称号与 `match_history`、`account_growth`、`account_reward_ledger` 同一 `BEGIN IMMEDIATE` COMMIT；任一步抛错整场 ROLLBACK，沿既有 pending history 重试。
- exactly-once 由 `settled_matches(match_id,round)` 唯一门 + `match_history`/`account_reward_ledger`/`account_award_stats` 主键保证；重复 finish/重连/重启不重复计数或授予。
- 同账户多连接参加同场在 `settlement/history.ts` 按 `accountId` 合并为一个 `result`、一次统计与一次授予；CPU/旁观无 accountId 跳过。
- 普通中途离场在 `captureDeparted`（world.ts:253）删除账号映射前冻结 `roundStats`/真实 accountId；FORFEIT 离场人并入同一结算。断线窗口内重连不发统计，窗口到期一次。
- 花费聚合只读已 COMMIT 收据表，事务失败无行、replay 无新行，故不重复计；出售/退款表不参与。
- 不新增 API/poll；`RoleProfile`/`History`/结果快照是唯一查询面。

## 验收（本次未执行，沿既有范围）

- 服务端：普通真实账户 mode≤5 各自然终局一次，冻结 `roundStats/awards` 与快照、`match_history`、`account_title_stats`、`account_award_stats` 一致；重复 finish/重连/重启不重复。
- 统计语义：`shots/hits` 只随普通2001接受射击与其真实命中变化；burn/空袭/地雷/直接技能只进 `damage`；友伤/免伤/抵消不计 `hits`；`killCombo` 在死亡与新 round 清零。
- 花费：正常 BUY/保养/交易后 `spentMoney/spentTokens` 等于原价×数量或收据 cost/offers.money；同 requestId 重放、出售/退款、失败请求不增加。
- 奖章：九类型按上表在自然局触发，`awards[].score` 一次性并入本局分；CPU/旁观空；Home 与 summary 显示权威计数/图标。
- 称号：36–46、68–72、145–158 在满足累计条件时落地，缺统计不授予。
- 未取得：原服务器奖章/统计 writer、原奖章图标选取事件、原 Windows 对照、完整 1:1 字体像素；本文不新增 unit test/浏览器/build/type/lint，真实网络/双网页/HD/持久重启验收均未执行。

## 限制与已知问题

- 九奖章与统计均为采用规则，非原服务器执行等价；`*Damage` 作为阈值、`*Score` 作为加分，`datascale` 不参与奖章。
- 原奖章判定 writer、`shots/hits/damage/killCombo/spend` writer 未取得；采用规则可由本局真实统计判定，取得原始来源后可替换。
- 战车迷彩无请求收据表，暂不计入花费；交易星币/创意/技能点不是金钱/星币花费来源。
- 未取得 `m00x` 原始消费点、原奖章图标选取与 `game_summary` 185 控件 1:1；Home/summary 消费者在缺权威数据时保持空白。
