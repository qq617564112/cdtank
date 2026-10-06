# 称号运行与时序

本文件记录 M6-05 称号归属、佩戴、查询与快照投影的服务端最终实现。目录解析与授予判定
规则见 `title-client-business-design.md` 与 `title-domain-runtime.md`；此处只写已落地的持久结构、
事务边界、投影路径与来源分界。

## 持久结构

`apps/server/src/accounts/title.ts` 拥有三张明确类型表（正常 `CREATE TABLE IF NOT EXISTS`，
不建 migration framework/feature flag/hash）：

- `account_titles(account_id, title_id, granted_match_id, granted_round, granted_at)`，主键
  `(account_id, title_id)`，称号永久拥有、只加不删。
- `account_title_selection(account_id, title_id)`，显式佩戴选择；`title_id = 0` 表示主动清空。
- `account_title_playtime(account_id, match_id, round, seconds)`，每局真实冻结 PLAYING 时长，
  主键 `(account_id, match_id, round)`。

累计 `wins/losses/draws/kills/deaths` 与 `winStreak/loseStreak` 在每次授予时从该账户的
**全部** `match_history` 记录重算（不只 history 首页），按 `ended_at, match_id, round` 升序取历史
最大连段。`battleSeconds` 只来自 `account_title_playtime` 的真实结算时长；既有历史没有时长记录，
记为 unknown，不套用地图 `timeLimit`。

## 事务与 exactly-once

授予挂在 `apps/server/src/accounts/history.ts` 的 `AccountHistory.record` 内：同一
`BEGIN IMMEDIATE` 中先写 `settled_matches`/`match_history`（与奖励账本、成长同事务），
每条 participant 记录落库后再调 `AccountTitle.grant`。`accounts/title.ts` 不再自行开事务，
任一步抛错整场（历史 + 奖励 + 称号）一起回滚，`settled_matches` 不留假成功。

键 `(account_id, match_id, round)` 由既有 `settled_matches`/`match_history` 唯一门保证：重复
finish、queue retry、重启后再报时直接命中已存在结算，不重复计数、不重复授予、不重复累计时长。
同一账户两条连接参加同场由 `settlement/history.ts` 按 `accountId` 合并为一份 participant，
`elapsedSeconds` 取本 round 该账户真实最长一份，避免 double count。CPU/无账号参与者跳过。

授予评估调 `settlement/title.ts` 的 `evaluateTitleGrants(stats, ownedIds)`：从真实已拥有 ID
出发，每轮加入真实可判定新 ID，并以当前 owned+granted 数重新检查 158 号固定点。缺 producer 的
统计（hits/shots/damage/killCombo/九奖项/spend）保持 `undefined`，不按 0 冒领；本批可达的是
56 条 wins/losses/draws/streaks/kills/deaths/battleSeconds 条件，以及真实 owned 累计超过 50 时
固定点追加的 158 号。

## 时长来源

- 正式结算时留在场上的参与者：`World.finishRoom` 传 `now - room.startedAt` 的真实冻结时长。
- 普通中途离场者：`World.captureDeparted` 在删除玩家前按 `now - room.startedAt` 冻结离场时刻，
  离场人不会因为留场者继续比赛而延长累计。
- `LOADING`/等待阶段不计入 gameTime；`startRoom`/再战/新 round 沿用现有 reset，旧 pending
  载荷保存的是冻结值而非 live 读取。
- 既有历史无 elapsed 时不写 playtime 行；只有新正式结算统计增加 actual duration。

## 佩戴与投影

- 默认：账户无 owned 时 `titles.owned=[]`、`selectedTitleId=0`，没有默认称号、无 default grant。
- 首次授予且无 selection 行：读取时按最大 owned ID 作为当前佩戴，不落 selection 行。
- 已手动清空（selection 行 `title_id=0`）：保留 0，不再回落默认最高。
- 显式选择：`RoleProfile.selectTitleId` 必须来自认证 `account from conn`，接受非负整数；`0` 清空；
  其它值必须真实 owned，不可选未授或他人账户；`PLAYING`/`LOADING` 阶段拒绝编辑，拒绝不写。
  正常已有 RoleProfile 查询不加 API/poll，回包 `titles {owned:[{id,name,description}],selectedTitleId}`，
  原有 `profile/playerSummary/growth` 保持。

`world.bindTitle` 在加入/进入房间绑定与结算 receipt 提交后，把当前佩戴投影到
`PlayerState.title?:PlayerTitle`；`rooms/snapshot.ts` 只读该 badge，`PlayerSnapshot.title` 有值才出现。
`LobbyPlayers`/`Friends`/`Blacklist` 各既有 reply 的 `title?:PlayerTitle` 通过 `AccountStore.currentTitle`
查询，offline friend 也能带 badge，不暴露他人私有原资料/growth。原 numeric wire（角色属性 index 2
`m_iNowTitle`）只作 source fact，本批不改写 raw `RoleProfile` 偏移，生产 transport 为 typed badge。
正式结算首次成功或 retry 成功（`World.attachResultAwards`）后刷新仍在场账户的 badge，与
`publishReceipts` 时序不冲突；账户 disconnect 或中途 leave 不丢已 grant。

## 未执行

本文件记录实现，不代表真实网络、双网页、HD、持久/重启或原 producer 验收已执行。本批未运行
unit test、浏览器、build、type check、lint、exporter/native/生成器或自动验收。
