# Func19 结算奖励倍率运行时

本文件记录 Func19（技能 12501/12502/12503）结算奖励倍率的最终服务端实现规则。
业务合同见 `remaining-skill-business-design.md` 的「Func19 结算奖励倍率」；此处只写
已落地的源码路径、冻结/合并/事务边界，不重复草稿过程。

## 来源事实

- skill12501/12502/12503 为 `Trigger0/Target1/Func19`，各自的 Func19 首槽参数分别为
  `X100`、`Y100`、`Z100`，Effect/Sound 全 0。`combat-catalog.json` 的实际型字段为
  顶层 `triggerType`、顶层 `target` 与 `functions[].{type,x,y,z}`。
- item12501/02/03 的 `ItemSkill1` 分别指向这三个技能。取得入口为已有或由真实来源写入的
  owned item，再经 Home MARKER 装配；`battleSkillSources` 从 profile `0x13c` 的三个真实
  instanceId 反查 `ownedQuantity > 0` 的 inventory 记录并展开 `ItemSkill1`。本轮不新增 writer。
- 现有结算先冻结 `ResultPlayer.combatScore`/`totalScore`，再按 DataScale 结果率计算奖励。
  `money` 写入 profile `0x70`，originality/tech 写入账户成长账本，coin 基数为 0；
  `(account,matchId,round)` 在既有 `BEGIN IMMEDIATE` 中 exactly-once。

## 采用 policy

只从真实 `selectRoleSkills` 得到的 `selectedSkillIds` 读取；marker来源仅接纳已装配的
12501/02/03 经 `ItemSkill1` 展开的 Func19，不改变原 current/equipment/extra/item Func1 筛选。
同技能去重，每项按类型取实际选中值的最高非负百分比一次，负数或非有限值拒绝并保留 DataScale
结果。不从全局技能目录启用、不按拥有实例数量或相近技能编号推导。同账户多个 participant 在
结算合并时同样按类型取最高值。

在 DataScale outcome 率之后乘一次，且只在最终各项 `Math.round` 一次（base 已是
`round(combatScore)`、`moneyBase=base`、`orig=base/5`、`tech=base/10`）：

```text
money         = round(base       * (1 + outcomeMoney/100) * (1 + skillMoney/100))
originality   = round((base/5)   * (1 + outcomeOrig/100)  * (1 + skillOrig/100))
tech          = round((base/10)  * (1 + outcomeTech/100)  * (1 + skillTech/100))
coin          = rewardValue(0, outcomeCoinRate)
```

不新增 coin 基数、上限或 reward scoring；`rankPoints = previous.rankPoints + totalScore` 保持原样。

## 冻结到账户的唯一路径

1. 纯生产者：`settlement/reward-modifiers.ts` 的 `readResultRewardModifiers(skillIds)`
   只接受真实已选 id，返回 `ResultRewardModifiers{moneyPercent, originalityPercent, techPercent}`。
   `mergeResultRewardModifiers(sources)` 按类型取最高非负值一次；全为 undefined 时返回
   undefined，旧结果保持实际零倍率与原逻辑。
2. World 冻结：`World.leave` 在任何 `clearCopiedRoleSkill`/recompute 前读取当前真人的
   `battleSkillSources`，经 `selectRoleSkills(..., combatSkills, combatItemSkills)` 得到实际
   selected ids，再调用 `readResultRewardModifiers`。普通中途离场的结果保存在 server 私有的
   `DepartedParticipant.rewardModifiers`；同一路径立即触发 FORFEIT 时把同一冻结 Map 传给
   `finishRoom`，不会先清空临时来源再得到假零倍率。`finishRoom` 正常终局同样在自身清理前读取
   当前真人；CPU 不生成冻结值。
3. history 冻结：`settlement/history.ts` 的 `CommittedMatch.participants` 接收可选私有
   `rewardModifiers`（server 内部，不进共享协议）。`finishRoom` 给仍在线真人及旧 departed
   记录各复制一份冻结值；history 按 `accountId` 合并 participant 时对每类倍率取最高一次，
   完整复制冻结值进 `PendingPayload` 对应 participant。
4. 账户消费：`accounts/reward.ts` 的 `apply` 接受可选私有 `rewardModifiers`，并转发给
   `settlement/reward.ts` 的 `computeResultAward`（`RewardInput.player` 为 server 专用
   `FrozenRewardResult` 交集读法）。`ResultAward` 公共类型与 UI 只看到最终金额，不新增字段。
5. 事务与重试：冻结值随 pending payload 保存，`flush`/retry 直接复用，不重新读角色或重算技能来源。
   `recordMatchHistory` 与 `AccountReward.apply` 在同一既有 `BEGIN IMMEDIATE` 内保存 profile growth
  与 receipt；任一步抛错整场回滚，receipt 重放返回原值，late award 同一 receipt。不新开连接或事务。
6. receipt/late UI：成功提交或迟到的 `flush` 仍通过现有 `publishReceipts` 把 `ResultAward`
   回填到尚未释放的 `MatchResult.players[].award`；现有 room snapshot/UI 消费最终金额，不需要
   新协议字段。重复 finish 或 late flush 只复用 `PendingPayload` 中的冻结值，不重新读取一轮倍率。

冻结结果经 `grantMatchReward` 转发值进入 `AccountReward.apply`；`grant` 参数类型用 `Pick` 时
不会在运行时剥掉对象上的额外 `rewardModifiers` 属性，故无需改 AccountStore。普通公开 history
结果不加 serializer 字段：`MatchHistoryRecord` 由 `accounts/history.ts` 摊开 `result` 得到，
额外属性不参与序列化；`ResultPlayer` 本身无新增字段。CPU、无账户参与者不 grant。

## World 到 receipt 的实际路径

`World.leave(playerId)` 在角色仍保留当前 selected source 时先调用 `freezeRewardModifiers`。
该函数对每个非 CPU 在线角色执行：

```text
battleSkillSources(player)
  -> equipment().marks + player.inventory -> ItemSkill1 Func19 markerItemIds
  -> selectRoleSkills(sources, combatSkills, combatItemSkills)
  -> selected skill.skillId[]
  -> readResultRewardModifiers(ids)
```

`captureDeparted` 把结果写入本场私有 `DepartedParticipant`；`finishRoom` 的
`onMatchCommitted.participants` 对当前真人与旧 departed 各带一份
`rewardModifiers` copy。`accountMatchHistory` 按账户合并，`AccountReward.apply` 在同一
history transaction 内消费，`publishReceipts` 及现有 snapshot/UI 只读最终 `ResultAward`
金额。

## 未执行验收

本轮未运行 tests、浏览器验收、构建或类型检查，也未做真实双连接 leave/forfeit、事务重放或
late receipt 实测。Func19 的 World producer、冻结 participant、history/account 事务与 receipt
路径已接入源码；集成结果仍待 root 的后续集中验证。当前 M 批次评审范围不包含本 P feature，
不能据此声明本次改动已经过 review。
