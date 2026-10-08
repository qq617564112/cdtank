# 账户统计与九奖章正式业务设计（M6-05 / M2-11 剩余统计与奖项）

本文定义账户统计、九奖章、结算冻结和下一批 battle/account/UI 的接口。来源分为两类：`title.dat`、`m001..m005.dat` 已验证表和源客户端结果/显示链的直接事实；原 server writer 未取得而由本项目明确采用的判定政策。采用政策不写成原事实，也不从缺失字段或默认零值造奖。

奖励货币和账户成长仍由 M6-02 `settlement/reward.ts` 负责。统计、奖项、称号与冻结战绩复用既有 `World.finishRoom → settlement/history.accountMatchHistory → AccountStore.recordMatchHistory → accounts/history.record` 链和 `settled_matches(match_id,round)`/`match_history(account_id,match_id,round)` 的 exactly-once 门，不新增独立结算入口。

## 原来源事实

| 范围 | 已发布直接来源 |
| --- | --- |
| 称号目录 | `CDTank/Data/table/title.dat` 的158行及 `称号ID/称号名称/说明/FunctionType/FunctionX/FunctionY/FunctionZ/a/b/c` 列，已验证副本为 `recovery/output/verified/tables/title.json`。 |
| 统计选择器 | `FunctionX/Y/Z`：1获胜、2失败、3打和、4连胜、5连败、6战斗总时间(秒)、7击毁、8被击毁、9发射总数、10命中总数、11连续击毁、12造成伤害总数、13花费总数、15完美、16优秀(MVP)、17残酷(Savage)、18悲情(Console)、19勇猛(Brave)、20慈悲(Kind)、21狡猾(Crafty)、22腼腆(Shy)、23贪婪(Greedy)。 |
| 九奖章列 | `m001.dat`–`m005.dat` 共26行，每行包含 `Perfect/PerfectScore`、`MVP/MVPScore`、`Savage/SavageDamage/SavageDamagePlus/SavageScore`、`Console/ConsoleDamage/ConsoleDamagePlus/ConsoleScore`、`Brave/BraveScore`、`Kind/KindDamage/KindDamagePlus/KindScore`、`Crafty/CraftyDamage/CraftyDamagePlus/CraftyScore`、`Shy/ShyScore`、`Greedy/GreedyScore`，已验证副本为 `recovery/output/verified/tables/m00*.json`。 |
| 奖章表值 | 26行的九个enable列均为1；`SavageDamage=200`、`ConsoleDamage=100`；`KindDamage`和`CraftyDamage`为100，mode4为50；对应 `DamagePlus` 为30，mode4为15。各 `*Score` 直接取原行值。 |
| 结果显示 | `result-reward-display-native.json` 的回调 `0x4ac736` 读取本局结果消息并显示货币/成长数量；`game_summary` 每名玩家的奖章格只有5个，源类型显示顺序为 Perfect、MVP、Savage、Console、Brave、Kind、Crafty、Shy、Greedy。 |
| 射击链 | 源4288fe自由瞄准分支即时调用423956→489ba8；本机对应 `actors.ts` 的 `beforeFire`→`fireProjectile`，玩家命中对应 `world.ts` 的 `resolveShotPlayerHit`→`applyPlayerDamage`。 |
| 命中事件 | `MsgRoomEvent` 的 `hit` 携带真实 `value` 和可选 `shotPlayerResult:{itemId,critical}`；`friendlyFire`/`immuneHit` 当前走独立分支。 |
| 结算冻结 | `World.finishRoom` 冻结 `ResultPlayer{team,rank,name,kills,deaths,objectivesDestroyed,combatScore,outcomeBonus,totalScore,outcome}`；账户回执在 `settlement/history.ts` 按账户去重后与战绩同事务提交。 |
| 消费收据 | `shop_purchases`、`tank_purchases`、`pet_purchases`、`part_maintenance`、`tank_maintenance`、`trade_receipts` 以 `(account_id,request_id)` 或 `session_id` 去重；出售/退款在独立的 `*_sales` 表。 |

## 统计合同

### 每局字段

`MsgRoomSnapshot` 的正式 shared 合同为：

```ts
export type AwardType = 'perfect' | 'mvp' | 'savage' | 'console' | 'brave'
  | 'kind' | 'crafty' | 'shy' | 'greedy';

export interface RoundStats {
  shots: number;
  hits: number;
  damage: number;
  damageTaken: number;
  killCombo: number;
  friendlyFireDamage: number;
  healing: number;
  rearDamage: number;
}

export interface RoundAward {
  type: AwardType;
  score: number;
}

export interface ResultPlayer {
  // 既有字段保持不变。
  roundStats?: RoundStats;
  awards?: RoundAward[];
}
```

每局次数由真实 unique `awards` 列表推导，每种奖项每人每局至多一次；`ResultPlayer.award` 仍保留既有货币/成长回执。

### Producer 语义

| 字段 | 真实 producer 规则 |
| --- | --- |
| `shots` | 不限2001：真实已接受并实际发射的普通当前ammo每次一。Func22/23只是modifier，不额外加一次；CAS拒绝、0.4 pending取消、尚未真正fire不计。 |
| `hits` | 同一ordinary ammo链在成功、非healing、敌对角色HP真实减少时，每shot至多一；DOT/direct airstrike/trap不冒充shot。自然保持 `shots >= hits`。 |
| `damage` | 敌对role真实HP减少，按实际减少量并在overkill时clamp；包含burn/airstrike/trap，不含scene HP。 |
| `damageTaken` | 敌方造成的自身role真实HP减少；友伤只进入独立的 `friendlyFireDamage`。 |
| `friendlyFireDamage` | 友方实际造成HP减少时另计，不把全项目友伤描述为永不掉HP。 |
| `healing` | 真实恢复非自己友方HP，沿实际medical ammo链，clamp到目标max HP。 |
| `rearDamage` | 实际背面分类造成的敌对HP减少，沿既有damage facet/bearing来源；纯domain不猜selector。 |
| `killCombo` | 本人无死亡期间最大真实enemy kill；死亡和新的round清零。 |

敌我判定复用实际mode规则。mode4/5不能因同team数字当友军；battle producer必须给出真实敌对/友方分类。`healing` 与 `rearDamage` 由下一battle worker生产，纯awards模块只读取冻结stats；即使值为0，也按真实比较参与阈值，是否实际参赛仍由 `playedSeconds > 0` 和对应实际contribution资格决定。

### 账户字段

```ts
export interface AccountStatistics {
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  loseStreak: number;
  battleSeconds: number;
  kills: number;
  deaths: number;
  shots?: number;
  hits?: number;
  damage?: number;
  killCombo?: number;
  spentMoney?: number;
  spentTokens?: number;
}

export interface AwardCounts {
  perfect: number;
  mvp: number;
  savage: number;
  console: number;
  brave: number;
  kind: number;
  crafty: number;
  shy: number;
  greedy: number;
}

export interface ResRoleProfile {
  // 既有 playerSummary/profile/growth/titles 保持不变。
  statistics?: AccountStatistics;
  awards?: AwardCounts;
}
```

历史缺统计不猜0，新增optional字段只在真实producer/ledger存在时附值。`battleSeconds` 沿当前title已记录的seconds窗口；旧history缺秒不猜 `timeLimit`。累计awards按真实unique `awards[].type` 计数，不按UI可见的5格裁掉。

## 九奖章竞争政策

九奖章以表现竞争名额，让伤害、治疗、背击和连杀分别体现不同打法。enable、伤害门槛参数和score从对应map行的原列读取；名额、资格和评选顺序为本项目业务规则。

### Config 合同

```ts
export interface ModeAwardConfig {
  enable: number;
  score: number;
  damage?: number;
  damagePlus?: number;
}

export interface ModeAwardsConfig {
  perfect: ModeAwardConfig;
  mvp: ModeAwardConfig;
  savage: ModeAwardConfig;
  console: ModeAwardConfig;
  brave: ModeAwardConfig;
  kind: ModeAwardConfig;
  crafty: ModeAwardConfig;
  shy: ModeAwardConfig;
  greedy: ModeAwardConfig;
}

export interface ModeMapConfig {
  // 既有map字段保持不变。
  awards: ModeAwardsConfig;
}
```

`MAPS` 逐map把九个原enable/score列，以及Savage/Console/Kind/Crafty的原始Damage/DamagePlus列写入 `awards`。`*Score` 按字面值使用，包括Kind 0、Crafty/Shy负分和mode5较低的Savage/Brave分；enable非1不授。

### 共同资格

- 参与者必须在本局实际 `playedSeconds > 0`。旁观和未形成真实参赛stats的玩家跳过。
- 每种奖章全场最多一名；没有达标者时该项空缺。每名玩家可因不同表现取得多个奖章，不按已得奖数量转让名额。
- 每名玩家每类型至多产生一个 `RoundAward`。
- `awards[].score` 在冻结结算时只加入一次 `combatScore`，`outcomeBonus` 不变。
- 所有评选获奖记录都保留；UI只显示每行固定顺序的前5项，不删除其余记录或账户计数。历史结算和账户计数保持已提交结果，后续结算使用本政策。
- CPU有真实本局stats时可以取得本局显示奖章，但账户层按account身份跳过；没有accountId不写累计。

### 判定

| 奖章 | 采用条件 |
| --- | --- |
| Perfect | `deaths === 0` 且 `kills + objectivesDestroyed >= 3`；该合计最高者一名，并列依次比较damage、kills、较小playerId。 |
| MVP | 仅冻结结算 `outcome === 'WIN'` 且 `kills > 0` 的玩家入选，全场最多一名；使用加奖分前的冻结 `totalScore` 排序，并列依次比较kills、objectivesDestroyed、较小playerId。败方、平局和0击毁不授优秀奖，没有合格者时空缺。 |
| Savage | 对敌真实damage达到Savage阈值的候选者中，damage最高者一名；并列依次比较kills、较小playerId。 |
| Console | `deaths >= 3`、`deaths > kills` 且受到敌方真实damageTaken达到Console阈值；候选者中damageTaken最高者一名，并列依次比较deaths、较小playerId。 |
| Brave | `deaths >= 1` 且真实无死亡连杀 `killCombo >= 3`；候选者中killCombo最高者一名，并列依次比较kills、较少deaths、较小playerId。 |
| Kind | 仅mode1–3，真实ally healing达到Kind阈值；候选者中healing最高者一名，并列依次比较较少deaths、较小playerId。 |
| Crafty | 真实rearDamage达到Crafty阈值，且 `rearDamage * 2 >= damage`，即背击至少占对敌总伤害一半；候选者中rearDamage最高者一名，并列依次比较damage、kills、较小playerId。 |
| Shy | `shots === 0`、`deaths >= 1` 且受到敌方damageTaken达到Console阈值；候选者中damageTaken最高者一名，并列依次比较deaths、较小playerId。 |
| Greedy | 仅mode4/5，`kills >= 3` 且 `kills > deaths`；候选者中kills最高者一名，并列依次比较较少deaths、objectivesDestroyed、较小playerId。以击杀数体现收割表现，与Savage的累计伤害竞争分别评选。 |

Savage、Console、Kind、Crafty的资格门槛，以及Shy复用的Console门槛为：

```text
原Damage + 原DamagePlus * max(0, 敌对参赛者数量 - 1)
```

这是按人数增加阈值的采用单位政策，不是原source证明。敌对参赛者数量在mode1–3按 `differentTeam`，mode4/5按其他玩家；源DamagePlus不被忽略。mode4的Kind/Crafty配置保留原Damage 50和DamagePlus 15，该模式只评选Crafty，Kind不参与。

### 纯Domain API

`apps/server/src/settlement/awards.ts` 提供 `computeRoundAwards`，并导出同签名别名 `settleAwards`：

```ts
interface AwardParticipant {
  playerId: string;
  team: number;
  outcome: 'WIN' | 'LOSE' | 'DRAW';
  playedSeconds: number;
  roundStats: RoundStats;
  kills: number;
  deaths: number;
  objectivesDestroyed: number;
  combatScore: number;
  outcomeBonus: number;
  totalScore: number;
}

function computeRoundAwards(
  map: ModeMapConfig,
  participants: readonly AwardParticipant[],
): Map<string, RoundAward[]>;
```

纯函数只读取传入的map和冻结participant，不读取World状态、不访问DB、不改输入。返回的数组按源显示顺序排列：Perfect、MVP、Savage、Console、Brave、Kind、Crafty、Shy、Greedy。MVP的 `totalScore` 输入必须是加奖分前冻结值，调用方不得把awards score回灌后再调用。

## 结算与账户接口

| 下一接口 | 责任 |
| --- | --- |
| battle `roundStats` freeze | 在真实battle路径累计上述字段；冻结 `playedSeconds`、结果、team和奖分前分数后调用 `computeRoundAwards`。 |
| battle combat freeze | 把 `awards[].score` 求和一次加入 `combatScore`，保持 `outcomeBonus`，然后生成既有 `totalScore` 和结果快照。 |
| account `applyMatch` | 在既有 `BEGIN IMMEDIATE` 内按真实account合并同一场连接，累计 `AccountStatistics` 和九个 `AwardCounts`；CPU、旁观和无真实producer字段不写猜测值。 |
| account spending | 只读已COMMIT消费收据的真实price/cost求和。历史price未冻结时保留unknown，不用当前catalog杜撰原paid额，也不重复hook。收据字段保留真实price/cost备查。 |
| account title/transaction | 与history、reward、title和award计数同事务提交；重复 `(match_id,round)` 不重复授予。 |
| UI result | `ResultPlayer.awards` 取前5项点亮固定顺序的奖章格，缺少数据保持空白。 |
| UI account | `ResRoleProfile.statistics/awards` 显示累计值；历史缺字段保持空白，不填零。 |

九奖章与统计的账户写入必须与 `match_history`、`account_growth`、`account_reward_ledger` 和称号写入共同COMMIT。任一步抛错整场ROLLBACK，沿既有pending history重试。普通中途离场在删除account映射前冻结真实stats；FORFEIT离场人并入同一结算。不新增API/poll。

`title.dat` 的剩余称号沿现有title domain的真实a/b/c单位判定。selector 13的149–151按原说明采用为money、152–154采用为tokens的split；该split是明确采用政策，不声称原列能单独区分货币。其它selector只在对应真实producer存在时启用。`FunctionType 2` 使用现有domain已解码的单位。缺少统计或为unknown时不授予，不把缺失字段补0。

## 真实未验范围

本设计中的统计生产、账户持久化、title接线和UI消费者由后续battle/account/UI workers实现。本批只完成config原始奖章列、纯awards domain和合同文档；没有把纯模块描述成已接真正shots、healing、rearDamage、ledger或页面。

未执行unit test、browser、build、typecheck、lint、exporter、native或autovalidation。未验证普通账户各mode自然终局、双端结算、重连/重启、CPU账户跳过、消费历史回填、完整奖章图标显示和原Windows像素/字体1:1。原server奖章/统计writer、完整 `game_summary` 185控件和原Windows对照仍未取得。
