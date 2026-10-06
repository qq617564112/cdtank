# 称号规则与资料展示业务设计（M6-05）

本文从原 `title.dat`、客户端现存称号字段和现有账户/历史/结算链，定义正式称号 domain、持久化接口、佩戴策略与资料展示消费者。直接来源事实、推导后采用的规则和未取得 producer 的条件分开登记。称号依赖 M6-02 结算事务与成长账本。

## 直接来源

| 范围 | 事实 |
| --- | --- |
| 目录 | `CDTank/Data/table/title.dat` 共 158 行，列为 `称号ID/称号名称/说明/FunctionType/FunctionX/FunctionY/FunctionZ/a/b/c`。已发布 `recovery/output/verified/tables/title.json` 的 `sha256=06111db3...`，CSV 同源。 |
| 条件类型 | 1 = 单阈值；2 = 比例；5 = `X+Y` 小于 `a` 且 `Z` 大于 `b`；6 = `X>a` 且 `Y<b`；7 = `X>a` 且 `Y>b`；8 = 奖项最大值门槛；9 = 奖项全部门槛；10 = 已拥有称号数门槛。 |
| 选择器 | 1 胜利、2 失败、3 平局、4 历史最高连胜、5 历史最高连败、6 战斗秒数、7 击毁、8 被击毁、9 发射、10 命中、11 单场最高连杀、12 伤害、13 原表花费列、15 完美、16 MVP、17 残酷、18 悲情、19 勇猛、20 慈悲、21 狡猾、22 腼腆、23 贪婪。 |
| 比例行 | 36–38 的 `X=10, Z=9`，含义为命中数 > 门槛且命中率 > `70/80/90%`；39–41 的 `X=9, Z=10`，含义为发射数 > 门槛且命中率 < `50/40/30%`。原表 `b` 为整数倒数形式 70/80/90 与 200/250/333，`c=0`。 |
| 花费行 | 149–154 的原列全部是 `FunctionX=13`，`FunctionY=FunctionZ=0`；152–154 的说明文本写“代币”，但可计算列仍是 selector 13。实现以原列为准，selector 13 映射 `spentMoney`，selector 14 映射 `spentTokens`；当前目录没有 14 行。 |
| 佩戴值 | `recovery/output/role-properties-native.json` 注册 index 2 `m_iNowTitle`，numeric type 14，record 偏移 `0x14`。这是唯一已证的原称号值字段。 |
| 显示消费者 | `game_main.xml`/`room_main.xml` 各有 `txtPlayerTitle0..11`；`myhome_playerpage.xml` 有 `txtPlayerTitle`；`playerlist_playerinfo.xml` 有 `txtPlayerTitle`；`myhome_playerpage_titlesummary.xml` 有 `lstTitles`。 |

行 19/20 的说明文本写 `<200`/`<500`，原 `a` 列为 `100`/`300`；实现采用表列值。152–154 同样以原可计算列 selector 13 为准，说明文字不覆盖表列。

## Domain 合同

正式 domain 由 `apps/server/src/settlement/title.ts` 拥有，`apps/server/src/config.ts` 只通过既有 `readTable('title')` 提供 `TITLE_TABLE`。

```ts
export interface TitleStats {
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;  // history maximum, not current run
  loseStreak: number; // history maximum, not current run
  kills: number;
  deaths: number;
  battleSeconds: number;
  hits?: number;
  shots?: number;
  damage?: number;
  killCombo?: number;
  spentMoney?: number;
  spentTokens?: number;
  awardCounts?: Partial<Record<AwardKind, number>>;
}

export function readTitleDefinitions(rows?: readonly TitleTableRow[]): readonly TitleDefinition[];
export const TITLE_DEFINITIONS: readonly TitleDefinition[];
export function evaluateTitleGrants(stats: TitleStats, ownedIds: Iterable<number>): number[];
```

`TitleDefinition` 保存 `id/name/description/condition/conditionAvailable`；不导出第二份 namebook。`conditionAvailable` 只表示当前统计 producer 是否齐全。`evaluateTitleGrants` 只返回“当前未拥有且实际 stats 可判满足”的 ID，顺序稳定；不会默认赠予，也不会因缺某个后续 producer 而返回 158 以外的空结果。

## 可满足的 56 条基础统计与 158 号

现有 history/结算可真实累计 `wins/losses/draws/winStreak/loseStreak/kills/deaths/battleSeconds`。按 `winStreak/loseStreak` 采用历史最大连段，满足条件的 56 条基础称号先正式接线。

158 号 `ownedTitleCount>50` 不能因为奖项/命中/花费 producer 缺失而永久禁授：评估以真实已拥有集合加本次新增 grant 计数，并在每次新增后迭代到固定点。即使本轮只有 56 条基础称号，真实历史累计到 51 条后 158 号也可授予。缺 producer 的其余称号保留目录和条件，`conditionAvailable=false`，未来补 producer 后无需改 158 的语义。

## 持久化与结算

后续 server worker 在 `AccountHistory.record` 的同一 `BEGIN IMMEDIATE` 内，按真实冻结 `ResultPlayer` 更新 typed `account_title_stats`，评估并插入 `account_titles`，再更新 `account_title_selection`。`match_history`、`settled_matches`、`account_growth`、`account_reward_ledger` 与称号写入共同 COMMIT；重复 `(match_id, round)` 不重复授予。

```sql
CREATE TABLE IF NOT EXISTS account_titles (
  account_id TEXT NOT NULL, title_id INTEGER NOT NULL,
  granted_match_id TEXT NOT NULL, granted_round INTEGER NOT NULL,
  granted_at INTEGER NOT NULL,
  PRIMARY KEY(account_id, title_id)
);
CREATE TABLE IF NOT EXISTS account_title_selection (
  account_id TEXT PRIMARY KEY, title_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS account_title_stats (
  account_id TEXT PRIMARY KEY,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  win_streak INTEGER NOT NULL DEFAULT 0,
  lose_streak INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  battle_seconds INTEGER NOT NULL DEFAULT 0
);
```

`battleSeconds` 使用冻结 `room.startedAt` 到 `room.endedAt` 的真实时长，不把 map `TimeLimit` 猜成历史战斗时长。旧 history backfill 可只从真实 `match_history` 重算胜负、击毁、死亡和连胜/连败；缺开始时间时不猜 `battleSeconds`。

## 佩戴选择

当前佩戴的规则是：无显式选择时采用 sticky 当前值；首次或没有当前值时取真实已拥有称号中的最高 `title_id`；显式选择必须校验 `title_id` 已拥有，且允许选择 0 清空。真正的“未选择”和手动的 0 清空必须在 typed selection store 中保持可区分。

原选择 opcode 未取得，因此不虚构“已有 wire 请求”。已证路径是 `m_iNowTitle` index 2 record `+0x14` type14，但这只证明原数值属性编码，不代表 runtime 已消费该 wire 值。当前 public schema 是：`PtlRoleProfile.ResRoleProfile.titles?: AccountTitles`，其中 `AccountTitles {owned: OwnedTitle[]; selectedTitleId: number}`，`OwnedTitle extends PlayerTitle` 并带 `description`；`PtlRoleProfile.ReqRoleProfile.selectTitleId?: number`，无字段为 query、有字段才按 authority select，0 主动清空。正常 other player info 使用现有 `PtlLobbyPlayers.Res.players[].title?: PlayerTitle`、`PtlFriends.FriendRecord.title?: PlayerTitle`、`PtlBlacklist.BlockedRecord.title?: PlayerTitle`；`MsgRoomSnapshot.PlayerSnapshot.title?: PlayerTitle` 只在有佩戴时出现。选择必须校验 ownership 来自 connection account，正式 phase 沿 account 可编辑资格（playing/loading 拒绝），不覆写未知 raw profile，不新增 API/poll，也不重复 snapshot 整个 title catalog。

`recovery/evidence/roles/role-numeric-property.ts` 是 index 2 的 direct-source 编码证据，但当前 runtime snapshot 没有真实的 `m_iNowTitle` wire 消费者。不能把 role-numeric-property evidence 当作已生产接线；实际接线归后续 shared/server worker。

## 展示

Home `lstTitles`/`titleText`、他人资料 `txtPlayerTitle`、等待/房间与战斗 HUD `txtPlayerTitle0..11` 都按权威 lookup 显示；缺失值保持空白，没有零默认，不造默认称号。资料查询沿既有 `PtlRoleProfile`/账户 profile 链；数值不得由 Web 推算。

## 验收

真实普通账户自然终局后的授予、重复 finish/重连/重启幂等、FORFEIT 冻结顺序、完整 history 累计、历史最大连段、`battleSeconds` 时长、无选择/显式选择 0/显式选择拥有称号、Home/他人/HUD 权威显示及缺 producer 条件保持未授予，均保持未执行。本文不改动 unit test、浏览器、构建、类型检查、exporter/native/生成器或自动验收。
