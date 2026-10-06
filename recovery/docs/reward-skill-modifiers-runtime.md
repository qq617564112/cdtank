# Func19 结算奖励倍率运行时

本文件记录 Func19（技能 12501/12502/12503）结算奖励倍率的最终服务端实现规则。
业务合同见 `remaining-skill-business-design.md` 的「Func19 结算奖励倍率」；此处只写
已落地的源码路径、冻结/合并/事务边界，不重复草稿过程。

## 来源事实

- skill12501/12502/12503 为 `Trigger0/Target1/Func19`，各自的 Func19 首槽参数分别为
  `X100`、`Y100`、`Z100`，Effect/Sound 全 0。`combat-catalog.json` 的实际型字段为
  顶层 `triggerType`、顶层 `target` 与 `functions[].{type,x,y,z}`。
- item12501/02/03 的 `ItemSkill1` 分别指向这三个技能。取得入口为已有或由真实来源写入的
  owned item，再经真实 `selectRoleSkills` 选择；本轮不新增 writer。
- 现有结算先冻结 `ResultPlayer.combatScore`/`totalScore`，再按 DataScale 结果率计算奖励。
  `money` 写入 profile `0x70`，originality/tech 写入账户成长账本，coin 基数为 0；
  `(account,matchId,round)` 在既有 `BEGIN IMMEDIATE` 中 exactly-once。

## 采用 policy

只从真实 `selectRoleSkills` 得到的 `selectedSkillIds` 读取；同技能去重，每项按类型取实际
选中值的最高非负百分比一次，负数或非有限值拒绝并保留 DataScale 结果。不从全局技能目录启用、
不按拥有实例数量或相近技能编号推导。同账户多个 participant 在结算合并时同样按类型取最高值。

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
2. history 冻结：`settlement/history.ts` 的 `CommittedMatch.participants` 新增可选私有
   `rewardModifiers`（server 内部，不进共享协议）。World 在终局或中途 leave 冻结参与者时
   捕获当时的 `selectRoleSkills` 结果并填入。history 按 `accountId` 合并 participant 时对每类
   倍率取最高一次，完整复制冻结值进 `PendingPayload` 对应 participant。
3. 账户消费：`accounts/reward.ts` 的 `apply` 接受可选私有 `rewardModifiers`，并转发给
   `settlement/reward.ts` 的 `computeResultAward`（`RewardInput.player` 为 server 专用
   `FrozenRewardResult` 交集读法）。`ResultAward` 公共类型与 UI 只看到最终金额，不新增字段。
4. 事务与重试：冻结值随 pending payload 保存，`flush`/retry 直接复用，不重新读角色或重算技能来源。
   `recordMatchHistory` 与 `AccountReward.apply` 在同一既有 `BEGIN IMMEDIATE` 内保存 profile growth
   与 receipt；任一步抛错整场回滚，receipt 重放返回原值，late award 同一 receipt。不新开连接或事务。

冻结结果经 `grantMatchReward` 转发值进入 `AccountReward.apply`；`grant` 参数类型用 `Pick` 时
不会在运行时剥掉对象上的额外 `rewardModifiers` 属性，故无需改 AccountStore。普通公开 history
结果不加 serializer 字段：`MatchHistoryRecord` 由 `accounts/history.ts` 摊开 `result` 得到，
额外属性不参与序列化；`ResultPlayer` 本身无新增字段。CPU、无账户参与者不 grant。

## 精确参数入口（World 尚未接）

本实现完成 Func19 冻结倍率业务 domain 与 history/account 接线。World 侧生产尚未接线：
`World.finishRoom` 组装 `CommittedMatch.participants` 时须为每个 participant 增加
`rewardModifiers`，`captureDeparted` 冻结普通中途离场者时同样须捕获。精确接入点：

- 终局：`apps/server/src/world.ts` `finishRoom` 内 `onMatchCommitted({... participants:
  [...room.players.values()].map(...)})`，对每个 `player` 计算
  `readResultRewardModifiers(selectRoleSkills(battleSkillSources(player), combatSkills, combatItemSkills)
  .map(skill => skill.skillId))` 并作为该 participant 的 `rewardModifiers`。
- 中途 leave：`captureDeparted` 冻结 `frozen`/`byRoom` 时对同一 `player` 计算并保存同一值，
  在 `finishRoom` 合并 `departedParticipants` 时带入。

接线前不得宣称已有 World 生产者或整个 Func19 已通过实测。

## 未执行验收

本轮未运行 tests、浏览器验收、构建或类型检查，也未接 World 生产入口或做真实双连接/事务重放
实测。因此只声明 Func19 纯 domain 与 history/account 接线已落地，不声明已有 World producer
或整条 Func19 端到端通过。
