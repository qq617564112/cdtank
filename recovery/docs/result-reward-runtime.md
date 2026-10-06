# 结算奖励与账户成长运行时

本文件记录 M6-02/M2-11 服务端结算奖励与账户成长的最终实现规则。原事实见
`result-reward-display-source.md` 与 `result-reward-client-business-design.md`；此处只写
已落地行为与来源分界，不重复草稿过程。

## 服务端流水线

1. 冻结：`World.finishRoom` 经 `settlement/finish-round.ts` 以当前 `room.players` 冻结
   `ResultPlayer` 名单（`id/team/rank/kills/deaths/objectivesDestroyed/combatScore/outcomeBonus/
   totalScore/outcome` 语义不变），在参与者离开前捕获真实 `accountId`，把名单与连接身份交给
   `onMatchCommitted`；普通中途离场者已并入冻结名单（见「FORFEIT」），胜者判定仍只看终局实际
   `players`。CPU、旁观无账户映射，直接跳过。
2. 算法：`apps/server/src/settlement/reward.ts`（纯深模块）。`base = max(0, round(combatScore))`；
   各项读 `datascale.dat` 对应结果的百分比（money 31/35/39、coin 32/36/40、tech 33/37/41、
   originality 34/38/42），
   `money = round(base*(1+rateMoney/100))`、`originality = round((base/5)*(1+rateOrig/100))`、
   `tech = round((base/10)*(1+rateTech/100))`、`coin = 0`。不施加草稿的无源 500/1000 上限，
   只保留非负语义；`coin = 0` 为「无基数授权」采用政策。等级 = 原 `level.dat` 积分要求
   （1..20，最高 399000）中 `积分要求 <= rankPoints` 的最大 `阶级ID`，边界采用 `>=`。
   `expPercent` 按下一阶级原阈值区间求 0..100，到顶 100。未取得来源的 21..27/98/99 不授。
3. 事务：`apps/server/src/accounts/reward.ts` 在 `accounts/history.ts` 的既有
   `BEGIN IMMEDIATE` 内与 `settled_matches`/`match_history` 同事务提交——
   `money` 累加到现可花费 `profile 0x70`，`rankPoints/level/originality/tech` 写独立
   `account_growth` 明确类型列，本局收据写 `account_reward_ledger`。任一步抛错整场回滚，
   `settled_matches` 不留假成功。
4. 重试：`settlement/history.ts` 沿既有 `pending` 队列保存失败冻结载荷，由世界 tick 的
   `flush` 重试；即使房间已释放、连接身份已删除，冻结载荷仍能落库。`flush` 成功后返回本次
   提交的 `roomId/round/收据`，`index.ts` 立刻交 `World.publishReceipts`；World 只在房间仍存在、
   同一 `roomId`/`round`、`FINISHED` 且结果仍有同 player 映射时把收据附到冻结 `ResultPlayer.award`，
   下个常规 snapshot 即带 late award。失败或重放不附 award，`grant` 失败绝不发 award；已释放房间
   只落库不再附快照，new round 不污染旧结果。

## exactly-once / 去重

- 事务键 `(account_id, match_id, round)`，`match_id = ${runId}:${roomId}`（每次进程启动新 UUID）。
- 首次结算写入；重复 finish/重连/重启后再报时，ledger 已有记录直接返回同一 `ResultAward`，
  不重复加钱、积分、等级、创意、技能点。
- 同一账户两条连接参加同场：按 `accountId` 键合并，只结算一次并返回统一收据。
- 再战 `round++` 产生新键，独立收据；旧键保留。

## FORFEIT

- 真实离房经 `leaveRoomPlayer`：`forfeitOutcome` 命中（剩人不足/擒王离场等）时在删除玩家**之前**
  冻结全部实际参与者（含离场人），判负离场人、留场人判胜，按各自冻结结果结算一次。
- 普通离房但留人继续（`forfeitOutcome` 未命中，含个人战剩多人）在删除玩家与账号映射清理**之前**
  冻结该 round 参赛者统计与真实 `accountId`（CPU/无账户跳过）。离场人不提前写奖、不写历史；
  终局时与当前实际 `players` 合并冻结名单，按现最终 outcome 一次结算，同账户由既有去重统一。
- `startRoom`/再战进入新 round、真正删除房间时清本 round departed roster；失败冻结载荷已在
  history `pending` 中，跨房间释放仍能落库。
- 断线窗口内 `pauseDisconnectedPlayer` 保留参与者，重连不发奖；窗口到期 `leave`→FORFEIT
  才结算一次。迟于旧局 `FINISHED` 加入者不在该局冻结名单，不纳入旧 award。

## 共享字段

服务端只消费 `@shared/protocols/MsgRoomSnapshot` 既有新增合同：

- `ResultPlayer.award?: ResultAward`，`ResultAward = {money, coin, originality, tech,
  rankPoints, levelBefore, levelAfter, expPercent}`；无 award 表示无权威收据。
- `PtlRoleProfile.ResRoleProfile.growth?: AccountGrowth`，`AccountGrowth = {rankPoints, level,
  originality, tech}`；`RoleProfile` 回复按账户独立账本返回，不覆写原 profile
  0x5c/0x9c/0xa0/0x80（尤其 `tech` 不写 pet learning 的 0x80）。初始账户若无原积分来源，
  独立账本从 0 开始，不伪造 earned。

## 实现路径

- `apps/server/src/settlement/reward.ts`：奖励/等级/百分比纯算法与 DataScale 读取。
- `apps/server/src/accounts/reward.ts`：`account_growth`/`account_reward_ledger`、事务内 apply。
- `apps/server/src/accounts/history.ts`：同事务挂载 `RewardGrant`。
- `apps/server/src/account-store.ts`：`grantMatchReward`/`accountGrowth`/`rewardReceipt` 接线。
- `apps/server/src/settlement/history.ts`：冻结、按账户去重、pending 重试、成功返回收据。
- `apps/server/src/world.ts`：结算冻结、把返回收据附到冻结 `ResultPlayer.award`。
- `apps/server/src/accounts/api.ts`：RoleProfile 回复附带 `growth`。

## 未执行验收

本轮未执行真实网络、双网页、HD、进程持久/重启、原 grant 或原 reward producer 对照；也未
关闭完整 185 控件 1:1、原经验条像素像素级或原 reward producer 等价。`coin = 0`、无上限
与 `>=` 等级边界均为采用政策，非原服务端执行等价。
