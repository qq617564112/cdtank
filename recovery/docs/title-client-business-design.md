# 称号规则与资料展示正式业务设计（M6-05）

本文在缺原服务器程序的前提下，从已发布称号表、源客户端现存反汇编/资格文档、已确认角色属性与现有账户/历史/结算链，给出可直接接线的称号业务规则。原事实与采用规则分列；未取得来源的条件保持不授予，不补造语义、不赠默认称号、不新增取数 API/poll。称号依赖 M6-02 的结算事务与成长账本。

## 交付范围

- 原 `title.dat` 158 条称号的门槛/统计字段恢复与可实施采用规则。
- 授予（ownership）在既有结算事务内 exactly-once 落地。
- 当前佩戴称号的持久结构与 HUD/资料消费接线方案。
- 本机资料（Home 玩家页）、他人资料（玩家资料页）、房间/战斗名单与 HUD 四个显示消费者的接法。

不关闭：`title.dat` 依赖未取得统计生产者（命中/发射/伤害/连杀/奖项计数/花费）的 102 条称号、`m00x` 九奖项计数 producer、原 Windows 对照、完整 1:1 字体/像素。

## 原来源事实

| 范围 | 原来源事实 |
| --- | --- |
| 称号表 | `CDTank/Data/table/title.dat` 实读 158 行，列 `称号ID/称号名称/说明/FunctionType/FunctionX/FunctionY/FunctionZ/a/b/c`；已解码 JSON/CSV 见 `recovery/output/verified/tables/title.json`、`title.csv`（`source` 指向 `title.dat`，`sha256` 已记录）。 |
| 表加载链 | 服务端 `apps/server/src/config.ts` 的 `readTable(name)` 经 `apps/server/src/runtime/content-paths.ts` 的 `sourceTablePath(name)` 读取 `recovery/output/verified/tables/<name>.json`；`CONTENT_TABLES` 可覆盖根，打包时 `scripts/package-release.mjs` 将其复制到 `content/tables`。新增 `TITLE_TABLE = readTable('title')` 与 `MAPS`/`TANKS` 同链，不跑 exporter。 |
| 条件语义 | 每个 `FunctionType` 的取值可由同行 `说明` 逐条核对：`1` 单统计 `X > a`；`2` 命中率 `X*100 > Z*b`（`X` 为被比统计，`b` 为百分比×100 的整数项）；`5` `X + Y < a && Z > b`；`6` `X > a && Y < b`；`7` `X > a && Y > b`；`8` `max(awardCounts) >= a`；`9` `min(awardCounts) >= a`；`10` `ownedTitleCount > a`。`X/Y/Z` 为统计选择器编号（见下表），非货币。 |
| 统计选择器 | `FunctionX/Y/Z` 使用：1 获胜、2 失败、3 打和、4 连胜、5 连败、6 战斗总时间(秒)、7 击毁数、8 被击毁数、9 发射总数、10 命中总数、11 连续击毁数、12 造成伤害总数、13 花费总数、15 完美奖、16 优秀奖(MVP)、17 残酷奖(Savage)、18 悲情奖(Console)、19 勇猛奖(Brave)、20 慈悲奖(Kind)、21 狡猾奖(Crafty)、22 腼腆奖(Shy)、23 贪婪奖(Greedy)。 |
| 当前佩戴称号 | `recovery/output/role-properties-native.json` 原属性注册：index 2 `m_iNowTitle`，numeric type 14，record 偏移 `0x14`（=20）；index 1 `m_iLV` 偏移 `0x10`、index 4 `m_bSex` 偏移 `0x34`。角色数值属性网线经 `recovery/evidence/roles/role-numeric-property.ts` 的 `encodeRoleNumericProperty`/`receiveRoleNumericProperties` 编码，index 2 为 `type 14` 4 字节。 |
| 显示消费者 | `game_main.xml` 12 个 `txtPlayerTitle0..11`、`room_main.xml` 12 个 `txtPlayerTitle0..11`、`myhome_playerpage.xml` 单个 `txtPlayerTitle`（第 222 行）、`playerlist_playerinfo.xml` 单个 `txtPlayerTitle`（第 248 行）均为 `WindowsLook/StaticText`；`myhome_playerpage_titlesummary.xml` 有 `lstTitles` 列表（`MyPlayerTS/lstTitles`）。原称号列表与已佩戴称号分别由 `lstTitles` 与 `txtPlayerTitle*` 消费。 |
| 现有账户/结算链 | `apps/server/src/accounts/history.ts` 的 `AccountHistory.record` 以 `settled_matches(match_id,round)` 唯一门与 `match_history(account_id,match_id,round)` 落库，同一 `BEGIN IMMEDIATE`；`apps/server/src/settlement/history.ts` 的 `accountMatchHistory.committed` 在冻结名单上逐人构造 participant、失败经 `pending` 队列重试。`apps/server/src/world.ts:675` `finishRoom` 冻结结果后 `apps/server/src/world.ts:686` 调 `onMatchCommitted`。 |
| 现有成长合同 | `apps/shared/protocols/MsgRoomSnapshot.ts:151` `AccountGrowth{rankPoints,level,originality,tech}`、`:158` `ResultAward`、`:169` `ResultPlayer`、`:181` `award?`；`apps/shared/protocols/PtlRoleProfile.ts:9` `growth?` 可选回包。成长查询经 `apps/server/src/accounts/api.ts:96` `RoleProfile` 的 `readRoleProfilePlayerSummary` 同链返回。 |
| 佩戴请求状态 | 未取得客户端→服务器的独立“选择/佩戴称号”请求 opcode、成功回包字段或原服务端 writer。现有可证的原路径是 `m_iNowTitle`（角色属性 index 2）与 `lstTitles`/`txtPlayerTitle*` 显示消费者；不据此补造新请求或新协议。 |

## 称号条件采用表

`统计名` 列按上表选择器编号解码；`可授予` 表示所需统计已由现有真实账户历史/结算链产出。未产出的条件不授予。

| ID | 名称 | FunctionType | 采用条件 | 备注 |
| --- | --- | --- | --- | --- |
| 1 | 嗷嗷待哺 | 5 | losses + draws < 10 and wins > 10 | 可授予 |
| 2 | 初出茅庐 | 5 | losses + draws < 50 and wins > 50 | 可授予 |
| 3 | 锋芒毕露 | 5 | losses + draws < 250 and wins > 250 | 可授予 |
| 4 | 齐天大圣 | 5 | losses + draws < 1000 and wins > 1000 | 可授予 |
| 5 | 爱拼才会赢 | 5 | losses + draws < 3000 and wins > 3000 | 可授予 |
| 6 | 呆若木鸡 | 5 | wins + draws < 10 and losses > 10 | 可授予 |
| 7 | 不堪一击 | 5 | wins + draws < 50 and losses > 50 | 可授予 |
| 8 | 泥菩萨过江 | 5 | wins + draws < 250 and losses > 250 | 可授予 |
| 9 | 兵败如山倒 | 5 | wins + draws < 1000 and losses > 1000 | 可授予 |
| 10 | 超级软柿子 | 5 | wins + draws < 3000 and losses > 3000 | 可授予 |
| 11 | 偶有小失 | 7 | wins > 500 and losses > 500 | 可授予 |
| 12 | 衰神附体 | 7 | wins > 1000 and losses > 1200 | 可授予 |
| 13 | 无地自容 | 7 | wins > 1500 and losses > 2500 | 可授予 |
| 14 | 人才 | 6 | wins > 500 and losses < 100 | 可授予 |
| 15 | 奇才 | 6 | wins > 1000 and losses < 220 | 可授予 |
| 16 | 天才 | 6 | wins > 1800 and losses < 500 | 可授予 |
| 17 | 我是好人 | 5 | wins + losses < 10 and draws > 5 | 可授予 |
| 18 | 我真的是个好人 | 5 | wins + losses < 50 and draws > 25 | 可授予 |
| 19 | 我是好人我怕谁 | 5 | wins + losses < 100 and draws > 50 | 可授予 |
| 20 | 人好到惊天动地 | 5 | wins + losses < 300 and draws > 100 | 可授予 |
| 21 | 这个好人救国救民 | 5 | wins + losses < 1000 and draws > 150 | 可授予 |
| 22 | 小试牛刀绽光芒 | 1 | winStreak > 10 | 可授予 |
| 23 | 旗开得胜下马威 | 1 | winStreak > 20 | 可授予 |
| 24 | 势如破竹无人敌 | 1 | winStreak > 30 | 可授予 |
| 25 | 日落西方东方不败 | 1 | winStreak > 40 | 可授予 |
| 26 | 独孤求败但求一败 | 1 | winStreak > 50 | 可授予 |
| 27 | 屡战屡败 | 1 | loseStreak > 10 | 可授予 |
| 28 | 力不从心 | 1 | loseStreak > 20 | 可授予 |
| 29 | 节节败退 | 1 | loseStreak > 30 | 可授予 |
| 30 | 四面楚歌 | 1 | loseStreak > 40 | 可授予 |
| 31 | 人见人欺 | 1 | loseStreak > 50 | 可授予 |
| 32 | 街头霸王 | 7 | wins > 500 and winStreak > 10 | 可授予 |
| 33 | 王者归来 | 7 | wins > 2000 and winStreak > 20 | 可授予 |
| 34 | 垂死挣扎 | 7 | losses > 500 and loseStreak > 10 | 可授予 |
| 35 | 就是不认输 | 7 | losses > 2000 and loseStreak > 20 | 可授予 |
| 36 | 不偏不倚 | 2 | hits > 1000 and hits*100 > shots*70 | 缺 hits/shots producer，不授予 |
| 37 | 百步穿杨 | 2 | hits > 5000 and hits*100 > shots*80 | 缺 producer，不授予 |
| 38 | 弹无虚发 | 2 | hits > 10000 and hits*100 > shots*90 | 缺 producer，不授予 |
| 39 | 深度近视 | 2 | shots > 2500 and shots*100 > hits*200 | 缺 producer，不授予 |
| 40 | 散光近视 | 2 | shots > 7500 and shots*100 > hits*250 | 缺 producer，不授予 |
| 41 | 老花眼镜 | 2 | shots > 15000 and shots*100 > hits*333 | 缺 producer，不授予 |
| 42 | 炮打出头鸟 | 1 | killCombo > 10 | 缺 producer，不授予 |
| 43 | 杀红眼 | 1 | killCombo > 20 | 缺 producer，不授予 |
| 44 | 无懈可击 | 1 | killCombo > 30 | 缺 producer，不授予 |
| 45 | 横扫千军 | 1 | killCombo > 40 | 缺 producer，不授予 |
| 46 | 完美打击王 | 1 | killCombo > 50 | 缺 producer，不授予 |
| 47 | 百人斩 | 1 | kills > 100 | 可授予 |
| 48 | 千人斩 | 1 | kills > 1000 | 可授予 |
| 49 | 霹雳火 | 1 | kills > 5000 | 可授予 |
| 50 | 万人敌 | 6 | kills > 10000 and deaths < 5000 | 可授予 |
| 51 | 唯我独尊 | 6 | kills > 50000 and deaths < 10000 | 可授予 |
| 52 | 破破烂烂 | 1 | deaths > 200 | 可授予 |
| 53 | 帅得想毁容 | 1 | deaths > 1000 | 可授予 |
| 54 | 还我漂漂脸 | 1 | deaths > 4000 | 可授予 |
| 55 | 同归于尽 | 6 | deaths > 20000 and kills < 10000 | 可授予 |
| 56 | 视死如归 | 6 | deaths > 100000 and kills < 30000 | 可授予 |
| 57 | 打架不用脑 | 7 | kills > 450 and deaths > 500 | 可授予 |
| 58 | 不管三七二十一 | 7 | kills > 1950 and deaths > 2000 | 可授予 |
| 59 | 为什么都打我 | 7 | kills > 9950 and deaths > 10000 | 可授予 |
| 60 | 高度危险者 | 6 | kills > 450 and deaths < 250 | 可授予 |
| 61 | 挡我者杀 | 6 | kills > 1950 and deaths < 800 | 可授予 |
| 62 | 近我者亡 | 6 | kills > 9950 and deaths < 3000 | 可授予 |
| 63 | 初尝禁果 | 1 | battleSeconds > 36000 | 可授予 |
| 64 | 逐渐上瘾 | 1 | battleSeconds > 180000 | 可授予 |
| 65 | 茶饭不思 | 1 | battleSeconds > 540000 | 可授予 |
| 66 | 不眠不休 | 1 | battleSeconds > 1080000 | 可授予 |
| 67 | 废寝忘食 | 1 | battleSeconds > 1800000 | 可授予 |
| 68-72 | 蛮力/机关枪/原子弹系列 | 6/1 | damage 条件 | 缺 damage producer，不授予 |
| 73-155 | 奖项/命中/连杀/花费系列 | 1/6/7/2 | 奖项计数、hits/shots、spend | 缺 producer，不授予 |
| 156 | 一技之长 | 8 | max(awardCounts) >= 500 | 缺奖项 producer，不授予 |
| 157 | 大满贯 | 9 | min(awardCounts) >= 100 | 缺奖项 producer，不授予 |
| 158 | 奇货可居 | 10 | ownedTitleCount > 50 | 依赖前面奖项称号，暂不可达，不授予 |

行 19/20 的 `说明` 正文（`<200`/`<500`）与本行 `a`（100/300）不一致；采用表列值 `a`（`FunctionX/Y/Z` 与 `a/b/c` 为原表数据列，`说明` 为展示文本）。原客户端消费以列值为准。

## 采用规则

1. 称号是**累计成就**，不是每局奖励：`ResultAward` 不新增称号字段，`money/coin/originality/tech` 语义不变。
2. 统计来源优先用**现有真实账户历史**。`match_history` 已保存每局 `ResultPlayer{outcome,kills,deaths,...}` 与 `endedAt`；`wins/losses/draws` 按 `outcome` 计数，`winStreak/loseStreak` 按 `endedAt, match_id, round` 升序的连续结果求当前与历史最大连段，`kills/deaths` 为累计和。
3. `battleSeconds` 不能从 `match_history` 得出（记录无开始时间）。采用 typed 独立 store，在结算冻结时用 `room.startedAt`→`room.endedAt` 的时长累加，来源为服务端权威冻结结果，不猜 raw 字段。
4. `hits/shots/damage/killCombo` 与九奖项计数、`spend` 当前**无 producer**：typed store 预留列但保持未启用，相关称号保持未授予。九奖项计数对应 `m00x` 的 `Perfect/MVP/Savage/Console/Brave/Kind/Crafty/Shy/Greedy` 列，其授予 producer 未取得，不能由胜负/击杀冒充。
5. 授予评估在 M6-02 的同一账户事务内、`match_history` 落库之后进行：对每条 `FunctionType ∈ {1,2,5,6,7,8,9,10}` 用上面采用表逐一判定，命中且未拥有则插入 `account_titles`，同 `(account_id,title_id)` 幂等。`ownedTitleCount`（FunctionType 10）来自 `account_titles` 行数。重复 finish/重连/重启按唯一键只授予一次。
6. **不赠默认称号**：新账户 `account_titles` 为空，`account_title_selection` 为空，`txtPlayerTitle*` 保持空白，直到真实累计历史满足条件。
7. **当前佩戴采用策略**：原佩戴请求/回包未取得，采用最小可实施规则——账户拥有称号后，若无显式选择则当前佩戴 = 拥有称号中 `称号ID` 最大者（`title.dat` 中同类进阶称号 ID 递增）；显式选择存入 typed `account_title_selection`，同一事务保持。该策略是重建选择，明确非原交互还原，可逆、可在取得原请求后替换。
8. 当前佩戴投影到已确认的 `m_iNowTitle`（角色属性 index 2，record+0x14，`type 14` uint32）经 `role-numeric-property.ts` 编码，HUD/房间/资料消费者读取该值；不再新增 wire 字段。`TitleID` 与 `称号ID` 一致。

## 最小共享合同

shared 侧已由 `e44980f` 提交，不新增字段：

```ts
// apps/shared/protocols/MsgRoomSnapshot.ts:151,158,169,181
export interface AccountGrowth {rankPoints: number; level: number; originality: number; tech: number;}
export interface ResultAward {money: number; coin: number; originality: number; tech: number;
  rankPoints: number; levelBefore: number; levelAfter: number; expPercent: number;}
export interface ResultPlayer { /* 既有字段不变 */ award?: ResultAward; }
```

称号不进入 `ResultAward`/`AccountGrowth` 之外的新协议；`PtlRoleProfile.ResRoleProfile.growth?`（`apps/shared/protocols/PtlRoleProfile.ts:9`）保持不变。当前佩戴称号通过 `m_iNowTitle` 角色属性进入既有玩家快照/角色属性消费链，`TitleID` 直接就是 `称号ID`。

## 持久结构

沿既有 `AccountStore`/`AccountHistory` 的 SQLite，用项目正常 `CREATE TABLE IF NOT EXISTS`，不建 migration framework、不建 feature flag、不写 hash/checksum：

```sql
CREATE TABLE IF NOT EXISTS account_titles (
  account_id TEXT NOT NULL, title_id INTEGER NOT NULL,
  granted_match_id TEXT NOT NULL, granted_round INTEGER NOT NULL,
  granted_at INTEGER NOT NULL,
  PRIMARY KEY(account_id, title_id));

CREATE TABLE IF NOT EXISTS account_title_selection (
  account_id TEXT PRIMARY KEY, title_id INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS account_title_stats (
  account_id TEXT PRIMARY KEY,
  wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0,
  win_streak INTEGER NOT NULL DEFAULT 0, lose_streak INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0, deaths INTEGER NOT NULL DEFAULT 0,
  battle_seconds INTEGER NOT NULL DEFAULT 0);
```

`account_title_stats` 与 `account_titles`/`account_title_selection` 由称号模块拥有；`rank_points/level/originality/tech` 归 M6-02 的 `account_growth`，称号模块只读不写，避免与成长账本重复。命中/发射/伤害/连杀/奖项/花费若后续取得 producer，再在该表追加明确类型列并接线，不覆写 raw `RoleProfile` 未证明偏移。

## 按文件实现归属

| 层 | 文件 | 责任 |
| --- | --- | --- |
| server 表 | `apps/server/src/config.ts` | 新增 `TITLE_TABLE = readTable('title')`，与 `MAPS`/`TANKS` 同链，不新增取数入口。 |
| server 深模块 | `apps/server/src/settlement/title.ts`（新） | 纯函数：`decodeTitlePredicate(row)` 按 `FunctionType` 解析；`evaluateTitleGrants(defs, stats, ownedCount)` 返回新授予 `title_id[]`；不依赖 World 可变态。 |
| server 事务 | `apps/server/src/accounts/title.ts`（新）、`apps/server/src/account-store.ts` | `AccountTitle` 在 `AccountHistory.record` 的同一 `BEGIN IMMEDIATE` 内：更新 `account_title_stats`（真实冻结结果）→ 评估并插入 `account_titles` → 更新 `account_title_selection` → 与 `settled_matches`/`match_history`/`account_growth`/`account_reward_ledger` 一并 COMMIT；重复键返回同结果不重复授予。 |
| server 接线 | `apps/server/src/settlement/history.ts`、`apps/server/src/world.ts` | `accountMatchHistory.committed` 把冻结 `startedAt`→`endedAt` 时长与逐人 `ResultPlayer` 一并交给账户事务；`finishRoom`（`world.ts:675`）冻结名单在 `accountByConnection` 删除前构造，FORFEIT 离场人在删除前保留。 |
| server 查询 | `apps/server/src/accounts/api.ts`、`apps/server/src/accounts/profile/payload.ts` | 称号查询随已有 `RoleProfile` 或既有账户资料查询返回 `ownedTitles/titleStats`；不新增 poll/独立 API。`RoleProfile` 现有 `playerSummary/growth` 保持。 |
| server 投影 | `apps/server/src/accounts/battle-binding.ts`、`apps/server/src/world.ts` | 当前佩戴称号投影到角色属性 `m_iNowTitle`（index 2，record+0x14）随既有 `encodeRoleNumericProperty` 链发出；不覆写未证明的 `RoleProfile` 偏移。 |
| 本机资料 UI | `apps/web/src/interface/home/home-player-source-page.tsx`、`home-inventory.tsx` | `myhome_playerpage.xml` 的 `txtPlayerTitle`（第 222 行）与 `lstTitles` 列表消费本账户已拥有/当前佩戴称号；缺数据保持空白，不填零/模板。 |
| 他人资料 UI | `apps/web/src/interface/lobby/player-info.tsx` | `playerlist_playerinfo.xml` 的 `txtPlayerTitle`（第 248 行）消费目标账户当前佩戴称号；未知保持空白。 |
| 房间/战斗 HUD | `apps/web/src/interface/battle/battle-summary-page.tsx` 等 | `game_main.xml`/`room_main.xml` 的 `txtPlayerTitle0..11` 按槽位消费玩家快照当前佩戴称号；无值保持空白，不造默认称号。 |

## 验收（本次未执行，沿既有范围）

- 服务端：普通真实账户自然终局一次后，满足条件的称号在 `account_titles` 落地；重复 finish/重连/重启不重复授予。
- 统计：`wins/losses/draws/kills/deaths` 与全部 `match_history` 记录一致；`winStreak/loseStreak` 按 `endedAt` 升序正确；`battleSeconds` 等于冻结时长累加。
- 幂等：同 `(account_id, title_id)` 只一行；同账户多连接同场只计一次；CPU/旁观无 accountId 跳过。
- FORFEIT：离场人在删除前冻结、按 LOSE 计入，留场人按 WIN；断线窗口内重连不发奖，窗口到期只结算一次。
- UI：本机资料页/他人资料页/房间与战斗名单显示当前佩戴称号；无称号空白；数值来自权威账户，不由客户端推算。
- 未取得：`m00x` 九奖项计数、hits/shots/damage/killCombo/spend producer、原 Windows 对照、完整 1:1 字体/像素。

## 限制与已知问题

- 原服务器称号授予 writer 未取得；本设计为从 `title.dat` 列条件与现有真实累计统计采用的可实施规则，不声称执行等价。
- 佩戴/展示显式请求与成功回包未取得，采用“拥有后默认佩戴最大 ID + typed 显式选择”的重建策略，可在取得原请求后替换。
- 依赖缺 producer 的 102 条称号（命中/发射/伤害/连杀/奖项/花费）保持未授予；`m00x` 九奖项计数不能用胜负/击杀冒充。
- 未在 Windows 原程序重跑；本文不新增 unit test/浏览器/build/type/lint，全部真实网络、双网页、HD、持久/重启、grant/原 producer 验收未执行。
