# 结算奖励与账户成长正式业务设计（M6-02 / M2-11 / UI-19 / UI-20）

本文在缺原服务端程序的前提下，从已读原表、客户端结果接收器、确认账户字段和既有结算/账户/历史模块，给出可直接实施的正式 server/UI 合同。它一次性覆盖「服务端奖励算法 → 首次结算一次 receipt → 账户 exactly-once 保存 → 结果消息字段 → UI-19 整页 / UI-20 award 子页」的完整玩家闭环，不停在取证或单按钮。所有采用规则与原来源事实分列；未知原字段不补造语义。

## 交付范围

- M2-11：命中、击毁、友伤、时限、胜负与额外奖励的服务端一次结算。
- M6-02：原货币/创意/技能点显示字段、等级边界、exactly-once 奖励保存与重启恢复。
- UI-19：原 `game_summary.xml` 整页消费冻结 `ResultPlayer` 与本次奖励/等级，保持既有 Score/Extra 语义不冒充奖励。
- UI-20：原 `game_summary_award.xml` 13 控件 award 子页消费本次四值奖励。

不关闭：完整 185 控件 1:1、原经验条像素、原称号/勋章授予（M6-05）、原 reward producer 的 Windows 对照、全部 26 模式地图逐项自然对局（附录 MAP）。

## 直接来源事实

以下均为已读原文件/原执行结论，非本轮新增取证。

| 范围 | 原来源事实 |
| --- | --- |
| 结果显示字段 | `result-reward-display-native.json`：回调 `0x4ac736` 读取消息 `+c0`→`GameSummaryAward/txtMoney`(金钱)、`+c4`→`txtCoin`(星币)、`+c8`→`txtOriginality`(创意点)、`+cc`→`txtTech`(技能点)，全部 `%d` signed32 直显（`57c0d6`，缓冲32）。 |
| 结果身份 | 消息 `+d4` 在同控制器 `+510`；1/2/3 分别 WIN/LOSE/DRAW（`result-music-semantics-source.json`）。 |
| 显示门禁 | `439184` 取结果对应 DataScale 率，加 float32 1 后与 0 比较；非零显示消息值，为零显示字面 `"0"`。门禁只决定显不显示，**不对消息值再乘比例**。 |
| 结果比例 | `datascale.dat` 31–34 胜利金钱/星币/技能点/创意点增加百分比 = +50；35–38 平局 = −20；39–42 失败 = −50。 |
| 等级表 | `CDTank/Data/table/level.dat` 实读 29 行，列 `阶级ID/阶级名称/获得要求/积分要求/阶级图标ID/备注`。ID 1–20 按累计积分：0/300/1200/3000/6000/10500/16800/25200/36000/49500/66000/85800/109200/136500/168000/204000/244800/290700/342000/399000；ID 21–27 及以上为排行榜百分比/名次门槛（需全服排名，当前无来源）；ID 98 后冠 / 99 王冠为积分最高女性/男性玩家。 |
| 角色记录 | `role-properties-native.json`：index1 `m_iLV` 记录偏移16，原构造默认 1；index12 `m_iHP` 偏移84；index13 `m_iMaxHP` 偏移88。 |
| 账户资料 | `home-player-profile-numbers` / `home-player-profile-numeric-native.json`：368字节 RoleProfile 偏移 score=`0x5c`、money=`0x70`、tokens=`0x74`、orig=`0x9c`、tech=`0xa0`；宠物技能点=`0x80`（`pet-skill-learning-business.md`）。 |
| 地图/模式 | `m001.dat`–`m005.dat` 实读共 26 组合（mode1×7、mode2×5、mode3×7、mode4×4、mode5×3）。每行含 `HitScore/DestroyScore/BrokenScore/WinScore/LoseScore/DrawScore/TimeScore`、`Time`、`PlayerMin/PlayerMax`，以及 `Perfect/MVP/Savage/Console/Brave/Kind/Crafty/Shy/Greedy` 奖励列。 |
| 现有结算 | `settlement/match-result.ts` 冻结 `ResultPlayer{team,rank,name,kills,deaths,objectivesDestroyed,combatScore,outcomeBonus,totalScore,outcome}`；`combatScore`=本局地图事件分（取整），`outcomeBonus`=地图 Win/Lose/Draw 分，`totalScore`=两者之和。 |
| 现有事务键 | `accounts/history.ts`：`settled_matches(match_id,round)` 唯一门 + `match_history(account_id,match_id,round)`；`matchId=`${runId}:${roomId}`，`runId=randomUUID()` 每次进程启动新值。 |
| 生命周期 | `World.finishRoom`→`onMatchCommitted`，在 `accountByConnection` 删除前冻结；普通中途离场在删除与账号映射清理前由 `room.departedParticipants` 冻结统计与 `accountId`，终局与现 `players` 合并；CPU 经 `accounts.get(connectionId)` 取不到 accountId 被排除；`rooms/reconnection.ts` 断线先 `pauseDisconnectedPlayer`，窗口内重连 `restore`，否则窗口到期 `leave`→FORFEIT 结算。 |
| 地面掉落 | `dropitem.dat` 实读 14 行，列 `ItemType/Min/Max/ItemID/ItemTexture/SoundFile/EffectFile`，`ItemID` 为场景 `obj05001–obj05011`。这是掉落物**场景表现/类别→模型**表，不产出账户货币/经验。 |
| 称号 | `title.dat` 实读 158 行，列 `称号ID/称号名称/说明/FunctionType/FunctionX/FunctionY/FunctionZ/a/b/c`；FunctionType 计数 {1:79,2:6,5:15,6:42,7:13,8:1,9:1,10:1}，条件为累计统计（连胜/连败、命中率、击毁/被击毁、总时长、造成伤害、获奖次数、消费等），非货币。 |

### 明确不采用为奖励源

- `combatScore`/`totalScore` 是重建战斗分，**不得当作原货币奖励显示**；UI-19 的 Score/Extra 继续显示既有战斗分/胜负分语义。
- `m_iHP`(record+54)/`m_iMaxHP`(record+58) 及全部 `RoleCombatState` 数字字段是**对局态**，不是账户可写的 exp/成长源。
- `dropitem.dat` 不是账户奖励授权表；不因掉落类别发币、发经验。
- 原 reward producer、base 资格、舍入与原始账户写链未取得：本轮不声称原服务端执行等价。

## 采用业务政策（明确非原事实）

原服务端「每局货币基数」缺失。采用以下简单一致政策，tradeoff 是可能与未知原 base 不同；全部数值有界、与地图/胜负挂钩、可单独替换而不动 receipt/等级/显示合同。

### 等级与积分（成长边界用真原表）

- 账户累计 `rankPoints`（积分）= Σ 每局冻结 `ResultPlayer.totalScore`，下界钳 0。
- 等级 = `level.dat` 中 `积分要求 <= rankPoints` 的最大 `阶级ID`（1–20）。ID 21–27、98、99 依赖全服排行榜/性别最高，当前无来源，**保留 unknown 不授**。
- `expPercent`（prgExp/txtExpPercent）= `(rankPoints - 本阶级门槛) / (下一阶级门槛 - 本阶级门槛)`，取 0–100；到顶阶级为 100。此值来自真原阈值。
- tradeoff：原文字写「积分超过 N」；采用 `>=` 作为确定性边界，与原描述相差一个点以内，可后续单点修正。

### 四值货币（UI 显示字段）

对本局每个**真实非 CPU** 账户参与者：

1. `rate` = 结果对应 `datascale.dat` 增加百分比（WIN +50、DRAW −20、LOSE −50）。
2. `base = max(0, round(ResultPlayer.combatScore))`（每局非负四舍五入地图 combatScore，仅作「重建奖励基数」，不显示为奖励）。
3. 各值读对应原 DataScale outcome 百分比：money 31/35/39、coin 32/36/40、tech 33/37/41、originality 34/38/42；`moneyBase = base`、`originalityBase = base/5`、`techBase = base/10`、`coinBase = 0`。
4. `money = round(base*(1+rateMoney/100))`，`originality = round((base/5)*(1+rateOriginality/100))`，`tech = round((base/10)*(1+rateTech/100))`，`coin = 0`；只保留自然非负语义，不施加无源 500/1000 上限，不引入风控/scoretables。

`coin=0` 采用理由：`datascale` 确有星币百分比，但基数 producer 未知，且现库从不免费发星币；不冒然发放溢价货币。tradeoff：原版可能小额发星币，本轮保留为 0 并单独记录。

### 奖励与人数/时限/地图组合

- 胜负：决定 `rate` 与 `outcomeBonus`（真原表）。
- 地图：决定 `HitScore/DestroyScore/BrokenScore` 与时限（影响 `combatScore` 累积窗口），经 `base` 间接影响；地图不设独立货币倍率。
- 时限：只影响积分累积时长，奖励仍以冻结结果计算，不用原始时长重算。
- 人数：**不改变**单人奖励；`PlayerMin/PlayerMax` 只作开局资格，不作为奖励倍率。

### 称号/奖励列

- `m00x` 的 `Perfect/MVP/Savage/...` 及 `title.dat` FunctionType 条件为 M6-05 授予范围。本片只持久化其所需累计统计（见下），**不授予称号**。
- 结果页 `picAward*`/`picShowPrize` 只在有权威 award 时点亮；`pic*award*` 奖章无 producer 时保持原空白，不用胜负/击杀冒充。

## 服务端奖励算法（已实现）

新增深模块 `apps/server/src/settlement/reward.ts`（纯函数 + 一次 receipt 输入），不依赖 World 内部可变态，输入是冻结结果：

```ts
// 共享合同（MsgRoomSnapshot.ts），server/UI 同源
export interface ResultAward {
  money: number; coin: number; originality: number; tech: number;
  rankPoints: number; levelBefore: number; levelAfter: number; expPercent: number;
}
```

算法步骤：

1. `base = max(0, round(player.combatScore))`；各 rate 取对应 DataScale 结果行。
2. 四值按上式分别 `round(base_i*(1+rate_i/100))`；`coin=0` 为无基数授权政策。
3. `rankPoints = max(0, prevRankPoints + player.totalScore)`（`player.totalScore` 为地图积分和，冻结值）。
4. `levelBefore/levelAfter = levelFor(...)`（原 `level.dat` 真阈值，`>=` 边界）；`expPercent` 由原阈值区间求。UI 从 `levelBefore/After` 推 Up/Down，不加重复布尔字段；`receipt` key 只存 server ledger。

调用点：仅由已提交的 `finishRound` 结果触发；在 `World.finishRoom` 内、`onMatchCommitted` 之后、`accountByConnection` 删除前，对冻结名单逐人求值。CPU 与旁观无 accountId 直接跳过。禁止从实时 World 状态、客户端包或 `m_iHP` 重算。

## 最小共享协议新增

保留 `ResultPlayer` 既有字段语义，只**追加**可选奖励字段，不改动既有字段含义：

```ts
export interface AccountGrowth {rankPoints: number; level: number; originality: number; tech: number;}
export interface ResultAward {
  money: number; coin: number; originality: number; tech: number;
  rankPoints: number; levelBefore: number; levelAfter: number; expPercent: number;
}
export interface ResultPlayer {
  /* ...既有 id/name/team/rank/kills/deaths/objectivesDestroyed/
     combatScore/outcomeBonus/totalScore/outcome 全部不变... */
  award?: ResultAward; // 新可选字段；无奖励（CPU/旁观）保持缺省
}
// PtlRoleProfile.ResRoleProfile 追加 growth?: AccountGrowth
```

- 协议文件 `apps/shared/protocols/MsgRoomSnapshot.ts` 增 `AccountGrowth/ResultAward` 与 `ResultPlayer.award?`；`PtlRoleProfile.ts` 增 `growth?`；`serviceProto.ts` 由专用 shared worker 手工追加，不执行生成器。
- 结果消息 `+c0/+c4/+c8/+cc` 的身份映射到 `award.money/coin/originality/tech`；`+d4` 映射到既有 `outcome`。UI 只渲染这两个权威来源，不从 local 推算。
- 快照 `MatchResult.player.award` 就是统一 authority：首次结算产生、写入 receipt、随快照发布；重连/刷新/再战只读同一冻结结果。不加重复 `level/outcome/levelUp/down/receiptID` 字段。

## 账户 store 事务（exactly-once + 持久）

沿既有深模块（`AccountStore`/`AccountHistory`），新增 `apps/server/src/accounts/reward.ts` 的 `AccountReward`，由 `AccountStore` 暴露，并与历史记录**同一 SQLite 事务**提交：

```sql
CREATE TABLE IF NOT EXISTS account_growth (
  account_id TEXT PRIMARY KEY,
  rank_points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  originality INTEGER NOT NULL DEFAULT 0,
  skill_points INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS account_reward_ledger (
  account_id TEXT NOT NULL, match_id TEXT NOT NULL, round INTEGER NOT NULL,
  receipt TEXT NOT NULL,               -- 冻结 ResultAward
  PRIMARY KEY(account_id, match_id, round)
);
```

事务键：`(account_id, match_id, round)`，其中 `match_id=${runId}:${roomId}`（每次进程启动新 UUID），`round` 区分再战。

- 首次：在 `settled_matches` 与 `match_history` 写入的同一 `BEGIN IMMEDIATE` 内，判 ledger 无记录→写 `account_growth`（money 写 profile `0x70`，orig/tech/积分/等级写 `account_growth`）→写 `account_reward_ledger` receipt，一并 COMMIT。
- 重复（重连/重复 finish/重启后再报）：ledger 已有 `(account_id, match_id, round)` 时直接返回同 receipt，**不重复加钱/经验/等级**。
- 任一账户缺失、冲突或写失败：整场回滚，`settled_matches` 不留假成功；沿既有 pending 队列固定 tick 重试，连接身份删除不影响重试。重试成功后 `flush` 返回本次收据，`World.publishReceipts` 仅对仍存在、同 `roomId`/`round` 且 `FINISHED` 的房间补附 `ResultPlayer.award`，下个常规 snapshot 即带 late award；房间已释放只落库，new round 不受影响。
- 多连接隔离：奖励按 `accountId` 键。同一账户两条连接参加同场，第二条落到同 ledger 键→replay 只记一次，即「一账户每场一奖」，不重复不串号。
- CPU 不写真实账户（无 accountId，跳过）。

持久字段来源：

- money：复用现有权威可花费字段 profile `0x70`（Shop/出售已写该字段）。
- tokens：不写（`coin=0`，premium 不铸造）。
- 积分 `rankPoints`/等级 `level`/创意 `originality`/技能点 `tech`：写 `account_growth` 明确类型列，**不覆写 raw RoleProfile 的 `0x5c/0x9c/0xa0/0x80`**；尤其 `tech` 不写 pet learning 的 `0x80`。正价可花 money 复用现 profile `0x70` 赋值 helpers，不挪代币。
- 权威查询：`RoleProfile` 回复可选附带 `growth`；历史 receipt 与结果快照能恢复已授成长。初始账本若无原积分来源，从 0 开始，不伪造 earned；不用未证明 raw 字段当写链，不新增 account API/poll。

## 生命周期

- 正常终局（TIME_LIMIT/OBJECTIVE）：`finishRound` 提交一次→奖励一次→receipt 持久。
- 真实离房：`Leave`→`leaveRoomPlayer`；`forfeitOutcome` 命中时删除玩家前先冻结实际参与者（含离场人）→FORFEIT 结算，离场人按 LOSE、留场人按 WIN，同一 `(matchId,round)` 只写一次。普通离房但留人继续（个人战剩多人等）在删除与账号映射清理前冻结参赛者统计与真实 `accountId`，不提前写奖/历史；终局与现实际 `players` 合并，按现最终 outcome 一次结算，离场人已从 `room.players` 删除也按冻结记录纳入本局一次 receipt。`startRoom`/再战与真正删房清本 round roster，失败载荷跨 release 仍在 pending 中可落库。
- 断线：`pauseDisconnectedPlayer` 保留参与者；窗口内 `restore` 不结算不发奖；窗口到期 `leave`→FORFEIT 才结算一次。断线期间若对局自然终局，冻结名单已含该暂停玩家，按正常结算一次。
- 再战：`round++` 产生新 `(matchId, round)`，独立领奖；旧 receipt 保留。
- 重启：已提交 receipt 落 SQLite，服务重启后同库可读；`runId` 换新避免复用旧房号/round 造成重复或误丢弃。
- UI-19 原退出：`btnClose` 现有退出房间动作保留；再战是独立 Web 按钮，奖励不随再战重发。

## UI-19 / UI-20 接线

### UI-19 原 185 控件整页

- 归属：UI 线 owns `apps/web/src/interface/battle/battle-summary-page.tsx` + `battle-summary-page.css` + 专属 source/browser doc；主线 owns `battle-match.tsx` 的 FINISHED 桥与 `SourceButton game_summary.xml` suffix。
- 既有 `team/rank/name/combatScore/outcomeBonus/totalScore` 语义与渲染保持不变；Score/Extra 仍显战斗分/胜负分。
- 消费 `local.award`：`prgExp`（进度）、`txtExpPercent`、`picLv`（按 `award.level` 选 `lvNN`）、`picLevelUp`/`picLevelDown`（按标志显隐）接入；无 `award` 时保持空白。
- `pic*Award*`/`picShowPrize` 仅在有权威 award 时点亮；未取得 award producer 时保持原空。
- 原 `txtCat*/txtDog*` 十二槽、分页、再战投票、源 Close 严格焦点沿用现有实测。

### UI-20 `game_summary_award.xml` 子页

- 归属：UI 线新增 `battle-summary-award-page.tsx` + css + 专属 source/browser doc；主线 owns 该子页在 `battle-match.tsx` 的挂载。
- 13 控件逐项映射（已读原布局）：`wndDialog` 根 + `pic/daibitubiao/chuangyidian/jinengdian` 四图标 + `lblMoney/lblCoin/lblOriginality/lblTech` 四标签 + `txtMoney/txtCoin/txtOriginality/txtTech` 四数值。
- 数值直接取 `local.award.{money,coin,originality,tech}`（signed int32 `%d` 语义）；零值走显示门禁字面 `0`；不从 local 推算、不重复请求账户。
- 原触发/关闭事件未取得：采用「FINISHED 且本人有 award 时随整页挂载子页，点击/Enter/Escape 关闭回整页并恢复整页焦点」的 Web 附着，明确非原事件还原。
- 与 UI-19 关系：整页先显冻结结果，子页显本次四值奖励；`award.receipt` 为唯一 authority，重连/刷新只读同一快照值。

## 按文件实现归属

| 层 | 文件 | 责任 |
| --- | --- | --- |
| shared | `apps/shared/protocols/MsgRoomSnapshot.ts`、`PtlRoleProfile.ts`、`serviceProto.ts`（shared worker） | `AccountGrowth`/`ResultAward`、`ResultPlayer.award?`、`ResRoleProfile.growth?` |
| server 算法 | `apps/server/src/settlement/reward.ts`（新） | 纯奖励/等级函数，输入冻结结果 |
| server 事务 | `apps/server/src/accounts/reward.ts`（新）、`account-store.ts`、`accounts/history.ts` | `account_growth`/`account_reward_ledger`、与历史同事务 exactly-once |
| server 接线 | `apps/server/src/world.ts`、`settlement/history.ts`、`accounts/api.ts` | finishRoom 冻结后逐人求奖、receipt 提交、快照带 award、RoleProfile 带 growth |
| UI-19 | `apps/web/src/interface/battle/battle-summary-page.tsx`/`.css`（UI 线） | 等级/经验条/奖励图/整页 |
| UI-19 桥 | `apps/web/src/interface/battle/battle-match.tsx`（主线） | FINISHED 语义桥、suffix、子页挂载 |
| UI-20 | `apps/web/src/interface/battle/battle-summary-award-page.tsx`/`.css`（UI 线，新） | award 13 控件子页 |
| server 测试模块 | 无 unit test；沿既有实测入口 | 见验收 |

## 验收（沿既有范围，不新增 unit test/浏览器/build/type/lint）

- 服务端：普通真实账户 mode≤5 各自然终局一次，冻结结果与快照 `award` 一致，重复 finish/重连/重启不重复加钱加成。
- 账户：money 写 profile `0x70`，积分/等级/创意/技能点写 `account_growth`；同库真实服务重启后余额/积分/等级保持；CPU/旁观空；多连接同场只记一次。
- 离房/断线/再战：真实 Leave 判负一次，FORFEIT 冻结名单纳入离场人；普通中途离场不提前结算、终局合并纳入离场人一次；断线窗口内重连不发奖、窗口到期一次；再战 round 独立领奖。
- UI：UI-19 三分辨率整页显冻结结果 + 等级/经验；UI-20 award 子页显本次四值奖励；重开/重连值不变。UI 由独立 UI worker 负责，本批唯一集中走查登记关闭奖励弹层焦点回源 `btnClose`、成长带与既有状态文字重叠两处待修，root 最终集成 UI3/4 修复，未声称真实页面验收通过。
- 上述真实网络/双网页/HD/持久重启/原 reward producer 验收本轮均未执行；不勾完整父，不改 `progress.md`。

## 剩余源授权/实测缺口

- 原 reward producer：base 金额、资格、舍入与服务端原始账户写链未取得；本轮采用政策替代，未声称执行等价。
- 原 `+c0/+c4/+c8/+cc` transport 消息类型/codec 与账户成长持久关联未由回调链确认。
- 原 level.dat ID 21–27/98/99 依赖全服排行榜/性别最高，当前无来源，保留 unknown 不授。
- 原 `title.dat` FunctionType 全条件授予、`m00x` award 列（Perfect/MVP/...）producer 未取得，留 M6-05。
- 原 UI-19 185 控件 1:1、EXP 条像素、原字体与原 award 子页触发/关闭事件未还原。
- 原 `dropitem.dat` 与账户奖励无关联；场景掉落为 M4-10 范围。
- 未在 Windows 原程序重跑；本设计不依赖原 Windows 复跑即可实施服务端算法/receiver+UI 字段/账户 exactly-once 保存三项。
