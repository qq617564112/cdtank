# 剩余技能函数业务设计

本文是 Func6、Func17、Func19、Func20、Func21 的最终业务合同。原服务端 writer 缺失的部分，按原表、客户端通信、现有 `RoleSkillSources`/`selectRoleSkills` 及现有结算、库存和快照消费者给出可执行规则。来源事实与采用 policy 分列，不用未知原行为填补缺口。

所有技能是否生效先由真实 `RoleSkillSources` 构建，并经 `selectRoleSkills` 选择。客户端通信字段没有来源语义时不补默认值；不从全局技能目录、拥有实例数量或相近技能编号推导启用资格。

## 共用来源

原 `4335b5..4337d7` 的遍历顺序是当前 16 槽、绑定拥有战车六槽、角色额外技能和十个物品槽；重复与容量按现有 `selectedSkillIds` 处理。角色额外来源字段 `+0x88/+0x8c` 初始为 0，不是默认赠予 skill30001 的来源。

当前实际 `PlayerSnapshot.roleSkillSources.selectedSkillIds` 已足够驱动 Func19、Func20 和 Func21；Func21 不新增协议字段。只有 Func6 需要一个新的 optional `PlayerSnapshot.respawnProtection`，用于区分真实复活保护与物件 8 的无敌。

已知取得入口如下：

| 技能 | 原表入口 | 实际取得入口 |
| --- | --- | --- |
| 8 | item8.ItemSkill1；`Trigger1/Target1/Func6/T10` | 现有正式 owned item8 库存与普通使用 |
| 30001 | `Trigger7/Target1`，两个 Func6 槽 `T5/X3/Y20` 与 `T0` | 没有 item/pet/`PetSkill` 直接引用；不默认授予 |
| 10711 | pet102.Skill0；`Trigger4/Target1/Func17` | pet102 正式取得、选择并在槽 0 真实学习，首级 cost 200/cap1 |
| 12501/12502/12503 | item12501/02/03.ItemSkill1；Func19 分别 `X/Y/Z100` | 已有或由真实来源写入的 owned item，再经真实技能选择 |
| 20001/20002 | item20001/02 类别 6、ItemSkill1；Func20 分别为 `T1/X1/Y20001` 与 `T2/X1/Y20002` | 正常取得 writer 未恢复；本 policy 接真实 ground 拾取事务 |
| 13111/13112 | skill 自身 `Func21/Y1` 与 `Func21/X1`，RadarA/B/C 均为 0 | 已知 item/pet/`PetSkill` 无引用；原 part 表未冻结，取得来源保持唯一缺口 |

## Func6 重生与无敌

### 来源事实

- item8 关联 skill8，skill8 为 `Trigger1/Target1/Func6/T10`。现有物件 8 已接普通使用、持久消费、10 秒炮弹免伤、死亡/结算/再战清理和双方状态。
- skill30001 为 `Trigger7/Target1`，两个 Func6 槽分别为 `T5/X3/Y20` 与 `T0`，首槽 Effect100、第二槽 Effect37，sound 均为 0。原 item/pet/`PetSkill` 没有 30001 的直接引用。

### 采用 policy

物件 8 保持独立的 `invincibility.skillId=8`。每次真实复活在 `respawnPlayer` 恢复 status2 后建立一次 `{skillId:30001, expiresAt: now+5000}`，所有既有普通炮弹、direct、trap、airstrike 和技能免伤入口共同查询该状态。

角色来源若实际选择 30001，也只走这一入口，不叠第二个计时器。默认账户、`extraSkill=0` 和没有真实来源的角色不因此获得 30001。`X3/Y20` 保持原 literal，不解释为次数或秒数。

首次出生、死亡期间、`FINISHED` 和 `Leave` 不授保护。普通复活授一次，重复通知不刷新；死亡清除，下一生命重新授。Effect100/37 各发一次原技能消息，不增加第二效果队列。

### API

```ts
applyRespawnProtection(player: InvincibilityParticipant, now: number): boolean;
clearRespawnProtection(player: InvincibilityParticipant): void;
isInvincible(player: InvincibilityParticipant, now: number): boolean;
```

`PlayerSnapshot.respawnProtection?: {skillId: 30001; expiresAt: number}` 是唯一新增共享字段。`recompute` 或 `clearInvincibility` 只处理物件 8，不误删重生保护。

## Func17 技能模仿

### 来源事实

10711“你会我也会”为 `Trigger4/Target1`，Func17 的 T/X/Y/Z 全 0，Effect12/SE12。pet102 的 Skill0 为 10711，`PetSkill` 首级 cost 200、上限 1。现有最终死亡入口只在真实敌对击破后调用 `copyPassiveSkillAfterKill`；复制来源写入角色 combat `+0x88/+0x8c`，不写账户。

### 采用 policy

候选只取被击破 participant 的真实已选被动技能。来源顺序沿用受害者真实 16 槽及拥有槽的 `selectedSkillIds`，每项保留 `{baseId, rank}`；不能从全部 342 个技能 roll，不能复制 owned 实例、账户 rank 或未知 raw 字段。

每次普通敌对最终死亡只采样一次，使用一次 authority uniform `floor(roll*length)`。空候选、同队（mode 1–3）、自杀、自然物件无攻击者、攻击者已死亡或非 status2 均拒绝；不消费、不重试、不重新 roll。

命中后替换当前生命唯一的 `extraSkill`，不新增第二 extra 槽，不赠送技能点，不写 `role_records`、profile 或学习 receipt。满槽不影响 extraSkill；重复击杀可覆盖，死亡、复活、新 round 和 Leave 必清。是否永久保存由真实学习页另行决定，本 policy 不永久保存。

本采用只复制真实受害者被动。主动和条件技能的复制不属于本 policy，保持独立开放范围。同账户多连接仍以被击破的 participant 为计算单位，不跨连接写账户。

### API

```ts
selectCopySkill(candidates: readonly RankedRoleSkill[], roll: () => number):
  RankedRoleSkill | undefined;

applyCopiedSkill(attacker: CopyParticipant, target: CopyParticipant,
  mode: number, roll?: () => number):
  {kind: 'copied' | 'empty' | 'rejected'; selected?: RankedRoleSkill};
```

唯一 call site 是统一最终死亡阶段；成功写入后立即 dirty/recompute，下一次 `selectedSkillIds` 反映结果。Effect12/SE12 只随真实技能消息发送一次。

## Func19 结算奖励倍率

### 来源事实

12501、12502、12503 均为 `Trigger0/Target1`，Func19 的首槽分别为 `X100`、`Y100`、`Z100`，Effect/Sound 全 0；item12501/02/03 的 `ItemSkill1` 分别指向三个技能。

现有结算先冻结 `ResultPlayer.combatScore`/`totalScore`，再按 DataScale 31–42 计算奖励。money 写入 profile `0x70`，originality/tech 写入账户成长账本，coin 基数为 0；`(account,matchId,round)` 在 `BEGIN IMMEDIATE` 中 exactly-once。

### 采用 policy

在 `finishRound` 冻结参与者时，从该 participant 的真实 `selectRoleSkills` 结果读取 12501/12502/12503。每个技能类型只取实际选中的最高百分比一次，同账户多个 participant 在结算合并时也按类型取最高值，而不是相加或二倍叠加。

倍率值必须随冻结的待结算 payload 一起持久化；retry 直接使用冻结值，不重新读取角色或重新计算技能来源。最终结果通过现有 `ResultAward` 公开，不新增公开字段或临时内存 Map。

在 DataScale outcome 率之后乘一次并只在最终各项 `Math.round` 一次：

```text
money         = round(base       * (1 + outcomeMoney/100) * (1 + skillMoney/100))
originality   = round((base/5)   * (1 + outcomeOrig/100)  * (1 + skillOrig/100))
tech          = round((base/10)  * (1 + outcomeTech/100)  * (1 + skillTech/100))
coin          = rewardValue(0, outcomeCoinRate)
```

同一技能重复不叠加；负数或未知倍率拒绝该项并保留 DataScale 结果。`coin` 继续使用无基数 0 政策，不因 Func19 引入新基数。中途离场者在其冻结记录上计算一次；新 round 使用新键，旧 receipt 不变。

### API

```ts
interface ResultRewardModifiers {
  moneyPercent: number;
  originalityPercent: number;
  techPercent: number;
}

readResultRewardModifiers(skillIds: readonly number[]): ResultRewardModifiers;
computeResultAward({player, previous, rates, modifiers?}): ResultAward;
```

`readResultRewardModifiers` 只接收已经由 `selectRoleSkills` 得到的 ids。冻结 payload 保存每个技能类型的最高百分比；`accounts/reward.ts` 只消费冻结值并负责现有事务和 receipt。

## Func20 鱼骨与骨头

### 来源事实

item20001/20002 是类别 6、`ItemType=13`，`ItemMoney/ItemCoin/GGet/Durable=0`；`ItemSkill1` 分别为 20001/20002，`ItemSkill2` 同为 30005。skill20001/20002 是 `Trigger1/Target1/Func20`，参数分别 `T1/X1/Y20001/Z0` 和 `T2/X1/Y20002/Z0`，Effect/Sound 全 0。skill30005 是独立的 `Trigger1/Target1/Func2/HP30`，item 文案写 15，二者不能互相替代。

原 `UMsgPickupTreasure` receiver 的成功合同只是清理场景物件；0x58 Treasure 记录与 0x30 MyItem 不是同一身份。正常接触请求、拾取资格、持久数量和治疗 writer 仍未取得。

### 采用 policy

成功拾取使用现有 typed `InventoryWireRecord`/`BattleItemRecord` 和类别 6 的合法构造，只设置来源已明确的字段：稳定 `instanceId`、`itemTableId` 为 20001 或 20002、`ownedQuantity=1`、`battleQuantity=0`、`state=0`。其余字段保持该类型构造器定义的值，不把 category 6 伪装为 0x30 MyItem，不复制 Treasure record，不写“所有 unknown fields 为零”的规则。

拾取只在 PLAYING、存活、距离有效、对象存在且归属未改变时进行。同一 `BEGIN IMMEDIATE` 中写入库存与收据，成功后移除场景物件；失败回滚并保留物件，不伪造成功。已有同定义堆叠则数量加一，否则创建一个类别 6 记录。

Func20（ItemSkill1）只处理数量加一，是真实 ground 拾取的唯一写入者；HP 由 ItemSkill2 skill30005 的独立 Func2 决定。skill30005 实读 `Trigger1/Target1/Func2/HP30`，采用 30 为普通自用治疗量；item 文案 15 保持字面描述，不替代技能值。价格为 0 不构成免费购买资格，类别 7 全量出售不属于本合同。

普通自用采用入口 `battle/items/treasure-item-use.ts` 只放行 item20001/20002：已配置快捷槽、存活 status2、自用、缺失生命时先经持久 CAS 扣一份，再按 skill30005 治疗并 clamp 到当前玩法上限，发一次原技能通知；拒绝、满血或保存失败不改 HP、不扣量。该入口不执行 Func20 加一，不复制拾取、不开放整类别，也不改写原分类 1/2 的 `requestItemUse` 判据。两件物品原表 `BattleUseMax=0`，本重建按真实剩余 owned 初始化本局可用数与拾取/reconcile 同步，不发明每局上限、不称原行为。

完整 ground 合同由独立的 ground 业务合同继续维护；本合同的库存加一是类别 6 消费者，不声称现有 ground trap/ground item 已完整实施或替代其 producer。

### API

```ts
interface GroundTreasurePickup {
  roomId: string;
  playerId: string;
  groundId: string;
  itemTableId: 20001 | 20002;
}

pickupGroundTreasure(...): {
  kind: 'picked' | 'removed' | 'rejected';
  itemTableId?: 20001 | 20002;
  instanceId?: number;
  ownedQuantity?: number;
};
```

同一 `(roomId, groundId)` 只写一次收据，重试返回原 instance 和数量；并发同账户拾取在 `BEGIN IMMEDIATE` 中串行，不二次加一。CPU 和无账户参与者不写入。

## Func21 战术雷达

### 来源事实

skill13111 是 `Trigger0/Target1/Func21`，X0/Y1；skill13112 是 `Trigger0/Target1/Func21`，X1/Y0。两者 Effect/Sound 全 0，RadarA/B/C 原列均为 0。它们是 Trigger0 被动来源，不是需要持续或到期刷新的主动状态。

其它 13113、13121–13124、13131 的 Radar 值和 Func1 属于不同技能，不能借作 Func21 来源。已知 item/pet/`PetSkill` 没有 13111/13112 引用，原 part 表也尚未冻结；取得来源保持唯一缺口。

### 采用 policy

每次技能来源重算时，从真实 `selectedSkillIds` 直接计算：

```ts
radar = {
  jammer: selectedSkillIds.includes(13111),
  detector: selectedSkillIds.includes(13112),
};
```

本人和 mode 1–3 同队目标始终可见。mode 4/5 的其他参与者在雷达关系上按敌对处理；只有敌目标 `radar.jammer` 为真时，观察者才需要自己的 `radar.detector` 才能保留该 tactical marker。没有 jammer、同队或本人标记不受 detector 限制。

光学隐身仍是独立判断，与雷达纯组合：雷达 filter 不能解除 optical camouflage，optical camouflage 也不能自动移除 tactical marker 关系。雷达只过滤 marker，不隐藏 world/CPU actor，不改变伤害、AI 目标选择或世界模型。

2010 雷达干扰弹的 15 秒期限是这一关系的第二个敌对来源：合格命中接纳后目标获得独立 `radarJam` 状态，观察者本机 `PlayerSnapshot.radarJammed` 为真且无 13112 detector 时，敌对 tactical marker 隐藏。它是服务端命中的独立期限，不是 13111 来源，也不把 skill4008 的 `Func1` 当作 Func21 grant；原表 RadarA/B/C=999 保持字面，不相加为被动属性，也不证明原列单位。

### 消费者 API

```ts
readRadarState(skillIds: readonly number[]): {jammer: boolean; detector: boolean};

canObserveRadarMarker(observer: PlayerSnapshot, target: PlayerSnapshot,
  mode: number): boolean;
```

`canObserveRadarMarker` 先应用本人/队伍关系，再应用敌目标 jammer 与 observer detector 的组合。`selectedSkillIds` 是唯一来源；不读取全局 catalog，不读取 RadarA/B/C。

`canObserveRadarMarker(observer, target, mode, radarJammed = observer.radarJammed === true)` 的第四参是可选 jam 状态；省略时读取观察者本机 `radarJammed`，13112 detector 同时抵消 2010 与 13111 jammer。

当前正式 UI 消费者是 `apps/web/src/render/battle-minimap-renderer.ts`；雷达 marker 的过滤在该 renderer 的正式 tactical marker 消费链中执行。

## 实际缺口

13111/13112 的实际取得入口未恢复：已知 item/pet/`PetSkill` 无引用，原 part 表也未冻结。本合同的 radar 规则只在真实技能来源出现时生效，不用同类雷达部件或目录存在代替取得来源。
