# 剩余技能函数业务设计

本文为下一批 Func6、Func17、Func19、Func20、Func21 的统一实施合同。原服务端 writer 缺失的部分，按原客户端通信、现有 `RoleSkillSources`/`selectRoleSkills`、原 skill/item/pet 表及现有结算、库存、快照消费者采用明确规则。规则可直接拆给 server/shared/专职 UI，不在本批改 tasklist、source 或其它文档。

以下“来源事实”只写原表或已恢复入口直接证明的内容；“采用 policy”是实现选择，不冒充原 Windows 服务端执行。所有技能启用判断先走真实 `RoleSkillSources` 与 `selectRoleSkills`，不从全局 catalog 取技能。

## 共用合同

### 来源选择

原 `4335b5..4337d7` 顺序为当前 16 槽、绑定拥有战车六槽中通过被动 predicate 的技能、角色额外技能来源、十个物品槽展开；重复和槽容量按现 `selectedSkillIds` 发布。Func6/17/19/20/21 的新消费者只接收该结果或由同一来源构建。`extraSkill` 是角色记录 `+0x88/+0x8c`，不是“默认赠送 30001”；账户没有 30001 来源时必须保持零。

### 最小共享字段

现有 `MsgRoomSnapshot.ts` schema version 102 已提供：

```ts
PlayerSnapshot.roleSkillSources?: {
  currentSkillIds: number[];
  equipmentSkills: {baseId: number; rank: number}[];
  selectedSkillIds: number[];
}
PlayerSnapshot.invincibility?
PlayerSnapshot.opticalCamouflage?
MatchResult.players[].combatScore
MatchResult.players[].totalScore
MatchResult.players[].award?
```

本批不要求新增全局协议。只有 UI 确需区分“重生保护”与“物件 8 无敌”时，允许 shared worker 在 `PlayerSnapshot` 增加以下可选字段；旧快照缺字段按不存在处理：

```ts
respawnProtection?: {skillId: 30001; expiresAt: number};
radarVisibility?: {
  jammedUntil: number;
  detectorUntil: number;
};
```

奖励倍率不进入快照新字段，继续由 `ResultAward` 的 money/originality/tech 结果表达。地面鱼骨/骨头也不新增 `Treasure` 记录类型，使用现 `inventory` 记录及真实 `itemTableId` 20001/20002。

### 文件所有权

| 责任线 | 文件 | 内容 |
| --- | --- | --- |
| server battle | `apps/server/src/battle/skill-effects/*` 或各现模块原位 | Func6/17/20/21 的最终死亡、复活、拾取和雷达状态提交 |
| server lifecycle | `world.ts`、`battle/life.ts`、`battle/start.ts` | 唯一死亡/复活/round/Leave 边界及一次调用 |
| server settlement | `settlement/reward.ts`、`accounts/reward.ts`、`settlement/history.ts` | Func19 在冻结奖励基数上的倍率及同事务 receipt |
| server inventory | `account-store.ts`、对应 ground pickup 事务模块 | Func20 类别 6 持久加一及消费扣减 |
| shared | `MsgRoomSnapshot.ts`、`serviceProto.ts`（仅必要时手工同步版本） | 上述两个可选运行状态；不生成协议 |
| UI | `render/battle-players.ts`、`battle-minimap.ts`、Home/结果现页 | 重生保护显示、雷达标记过滤、结算奖励 text |

UI 沿用当前 React/字体规则；已有角色用当前玩家信息展示时，动态文字继续使用现 `XiangJiaoKuanMaoShuaLingGanTi-2.ttf`，已有数字图片不被新 DOM 文本替换。

### 来源与取得矩阵

| 技能 | 原表直接入口 | 当前已知取得入口 | 本轮 policy |
| --- | --- | --- | --- |
| 8 | item8.ItemSkill1，`Func6/T10` | 现有正式 owned item8 库存与普通使用 | 保留物件 8 的 10 秒无敌，不与 30001 合并 |
| 30001 | 无 item/pet/`PetSkill` 引用 | 未找到；roleflag 默认值也不能当来源 | 真实复活授 5 秒统一保护；不写账户、不默认授予 |
| 10711 | pet102.Skill0；`PetSkill` 首级 cost 200/cap1 | pet102 正式取得、选择、真实 LEARN 槽 0 | 真实敌对最终击破后一次采样受害者已选被动 |
| 12501/12502/12503 | item12501/02/03.ItemSkill1；三技能分别 `X/Y/Z100` | 已有或真实 grant 的 owned item；不从全局 catalog 启用 | 按真实 `selectRoleSkills` 结果乘 money/originality/tech 一次 |
| 20001/20002 | item20001/02类别 6、ItemSkill1；两技能 `Func20` | 正常取得 writer 未恢复；本 policy 接真实 ground 拾取 | 拾取事务持久加一；不伪造 0x58 Treasure |
| 13111/13112 | skill Func21 `Y1/X1`；已知 item/pet/`PetSkill` 无引用 | 已知冻结表中没有原 `part` 表或明确 grant；不得从 catalog 默认启用 | 仅对真实 `selectedSkillIds` 中的技能生效；取得来源保持缺口 |

---

## Func6 重生与无敌

### 来源事实

- item8 关联 skill8；skill8 为 `Trigger1/Target1/Func6/T10`，当前普通物件 8 已接自用、CAS 消费、10 秒免伤、死亡/结算/再战清理及双方状态。
- skill30001 为 `Trigger7/Target1`，两个 Func6 槽依次为 `T5/X3/Y20` 与 `T0`，首槽 Effect100、第二槽 Effect37，所有 sound 为 0。
- 原 item 表没有 30001 的 `ItemSkill*` 引用，pet 表没有 30001 的 `Skill0..5` 引用。现有 `extraSkill` 默认 0，未找到 30001 的来源写入或原服务端重生 writer。

### 采用 policy

1. 物件 8 继续只负责“普通库存施放”的 10 秒 invincibility；`invincibility.skillId=8`，不改名为 30001。
2. 每次真实复活在 `respawnPlayer` 成功恢复 status2 后调用一次 `applyRespawnProtection`。采用统一重生保护：`expiresAt = now + 5000`，使用普通炮弹/direct/skill/trap/airstrike 共用的 `isInvincible(target, now)` 分支。若后续确认角色来源已实际选中 30001，也只走同一入口，不叠成两个计时器。
3. `X3/Y20` 的原单位不明，本 policy 不宣称它们等于“3 次、20 秒”或其它数值；来源只保留 literal。若 `extraSkill` 确为 30001，仍不把默认赠予写进账户或 combat；是否有该角色来源由真实拥有/选中链决定。
4. trueclock 使用现有 World 单调毫秒时间。首次出生、死亡瞬间、FINISHED、Leave 不授；每次普通复活授一次，重复通知不刷新。死亡清除，下一生命重新授。
5. Effect100/37 仍按 skill id 30001 发送一次 play/stop 消息；若 UI 尚无独立重生效果消费者，可先复用现 retained skill effect queue，不制造第二绘制树。

### 接口与拒绝

```ts
applyRespawnProtection(player: InvincibilityParticipant, now: number,
  recompute: () => void): boolean
advanceRespawnProtection(roomId: string, player: InvincibilityParticipant,
  now: number, recompute: () => void, events: MsgRoomEvent[]): void
clearRespawnProtection(player: InvincibilityParticipant,
  recompute: () => void): void
```

refusal：非 PLAYING、非 status2、无角色记录、`!alive`、死亡清除阶段、同一生命已保护时返回 false 且不刷新。success：建立一个 `{skillId:30001, expiresAt}` 状态并使所有现有免伤入口可见。`clearInvincibility` 只清物件 8 状态，不误删重生保护；两者同时存在时任意一项有效都应免伤。

### 生命周期

- 首次 `initializeBattleParticipants`：先清本局状态，不授保护。
- `respawnPlayer`：成功后授 5 秒保护。
- `finalizePlayerDeath`：清重生保护，不提前为下一生命创建。
- `finishRoom`、`new round`、`Leave`：清状态和 event 投影。
- snapshot：现有 `invincibility` 语义保留物件 8；新增 `respawnProtection?` 为可选投影。若 shared 暂不扩字段，UI 只显示通用无敌时不能把它误标为库存无敌。

### 验收终点

自然击杀后用真实普通输入再次出现，证明前 5 秒内普通射击/direct 不扣 HP、5 秒后同一射击扣 HP；死亡期间不授、结算/再战/Leave 清除；物件 8 仍独立显示和消费。原 30001 来源、X3/Y20 单位及完整 Func6 执行器保持开放。

---

## Func17 敌方技能模仿

### 来源事实

- 唯一源技能 10711“你会我也会”：`Trigger4/Target1`，Func17 T/X/Y/Z 全 0，Effect12/SE12；pet102 的 Skill0 为 10711，`PetSkill` 首级 cost 200、cap1。
- 现有 `selectRoleSkills` 只把经原被动 predicate 的技能纳入属性来源；主动/条件技能即便复制到 `extraSkill`，也不会自动得到主动执行权。
- 现有最终死亡入口已调用 `copyPassiveSkillAfterKill`，只在真实敌对最终击破后采样受害者的已学被动，写入 combat `+0x88/+0x8c`，死亡/复活/新 round/Leave 清理；不写账户。

### 采用 policy

1. 候选来源必须是本次受害 participant 的真实 `ownedRoles`/`selectedSkillIds`，不能从全 342 目录 roll，不能复制拥有实例或账户 rank。
2. 每次普通敌对最终死亡只采样一次。先按受害者真实 16 槽及拥有槽的当前已选顺序建立 `candidates=[{baseId,rank}]`；本政策的候选保留原被动 predicate，主动和条件技能仍写入 `extraSkill` 但不宣称它们获得自动施放权。
3. 使用一次 authority uniform `floor(roll*length)`；空候选、同队（mode≤3）、自杀/自然物件无攻击者、攻击者死亡或非 status2 均拒绝，不消费、不重试、不重新 roll。
4. 命中后替换当前生命唯一的 `extraSkill`；不新增第二 extra 槽，不赠送技能点，不改 raw 未知字段，不写账户 `role_records`、`profile` 或学习 receipt。
5. 满槽不是候选失败条件：extraSkill 是独立角色来源，不写入 16 槽；只有当同一技能已在当前槽时由 `selectRoleSkills` 去重。重复击杀可覆盖为本次抽中的候选，死亡/复活/新 round/Leave 必清。是否永久保存由真实学习页单独决定，本 policy 默认不永久保存。
6. 同账户多连接：只在被击破的 participant 上计算候选，结果只存在于该 participant 的当前生命；账户不写，因此不会跨连接复制。退场者不再产生新结果，current round 的 snapshot 以各 participant 的 combat 字段为准。

推荐把现有 `copyPassiveSkillAfterKill` 收窄为纯入口：

```ts
selectCopySkill(candidates: readonly RankedRoleSkill[], roll: () => number):
  RankedRoleSkill | undefined

applyCopiedSkill(attacker, target, mode, roll?, catalog?): {
  kind: 'copied' | 'empty' | 'rejected';
  selected?: RankedRoleSkill;
}
```

调用者仍是 `World.commitPlayerDeath`，在 `10441` 最终死亡阶段后执行一次，并紧接统一 `recomputeBattleAttributes`。不要在同一死亡链重复调用，也不要从 projectile hit 或 lastStand 到期之外创建第二条采样。

### 生命周期

成功写入后立即 dirty/recompute；下一次 snapshot 的 `roleSkillSources.extraSkill`（若补投影）或 `selectedSkillIds` 必须反映结果。死亡/复活/新 round/Leave 清除并重算。Effect12/SE12 只从原技能消息发送一次，不因候选为空重试。

### 验收终点

两账户合法购买 pet102、真实 LEARN 10711、选择拥有实例；peer 具有至少一个已学被动来源。普通敌对最终击破恰好产生一次采样，双端 snapshot 来源一致；空候选、同队、重复、死亡/复活/新 round/Leave 的拒绝和清理逐项成立。主动/条件技能的完整原执行与 Effect12 原 producer 保持开放。

---

## Func19 结算奖励倍率

### 来源事实

- 三个源技能分别是 12501、12502、12503：`Trigger0/Target1`，Func19 的第一槽分别为 `X100`、`Y100`、`Z100`，Effect/Sound 全 0；item12501/12502/12503 的 `ItemSkill1` 分别指向它们，属于类别 6 贵重品范围的原记录。
- 现有结算先冻结 `ResultPlayer.combatScore`/`totalScore`，再由 `computeResultAward` 读取 DataScale 31–42；money 写 profile `0x70`，originality/tech 写 `account_growth`，coin 基数保持 0，`(account,matchId,round)` 在 `BEGIN IMMEDIATE` 内 exactly-once。
- 这表示“角色选择技能”与“奖励 producer”目前是两条链；不能把 catalog 中所有 12501/12502/12503 默认启用。

### 采用 policy

1. 在 `finishRound` 冻结每个 participant 时，同时从该 participant 的真实 `selectRoleSkills` 结果记录奖励倍率来源：12501 存在则 `moneyPercent += X(literal100)`，12502 则 `originalityPercent += Y(100)`，12503 则 `techPercent += Z(100)`。不读取账户全局 catalog，不把技能目录当拥有/启用来源。
2. 在现有 `computeResultAward` 内、DataScale outcome 率之后各乘一次，并且仅在各项最终值上 `Math.round` 一次：
   `money=round(base*(1+outcomeMoney/100)*(1+skillMoney/100))`，
   `originality=round((base/5)*(1+outcomeOrig/100)*(1+skillOrig/100))`，
   `tech=round((base/10)*(1+outcomeTech/100)*(1+skillTech/100))`。
   不先 round 中间值，不另加 500/1000 上限。
3. 三项均为正百分比；重复同一技能不叠乘，来源按技能 id 去重。若未来出现负 X/Y/Z，拒绝该项并保留 DataScale 结果，不把负数变成减益或反向退款。
4. `coin` 继续 `rewardValue(0, rate.coin)=0`；本 policy 不改变“coin 无基数 0”的既有政策。
5. 同账户多连接由现有 `byAccount` 冻结一次，采用该账户参与者中实际选中的倍率来源；两连接只产生同一 receipt，不重复乘。重放返回同一 receipt，retry 成功后只附 late award，不重算倍率。离场冻结与 FINISHED 合并仍在同一个结算事务键内。
6. 倍率来源作为 `ResultPlayer` 的 optional 内部冻结字段传入奖励纯函数；不要求公开到客户端。公开结果仍只给 `ResultAward` 四项金额。

推荐接口：

```ts
interface ResultRewardModifiers {
  moneyPercent: number;
  originalityPercent: number;
  techPercent: number;
}

readResultRewardModifiers(skillIds: readonly number[]): ResultRewardModifiers
computeResultAward({player, previous, rates, modifiers?}): ResultAward
```

`readResultRewardModifiers` 只接受已经由 `selectRoleSkills` 得到的 skill ids；在 `settlement/finish-round.ts` 或 `world.ts` 冻结 participant 时调用。`accounts/reward.ts` 保持事务所有权，不在此模块读取拥有记录或 UI。

### 生命周期与验收

首次结算同一事务写 profile/growth/receipt；重复 finish、断线重连、服务重启只读 receipt；中途离场者在其冻结记录上计算一次；新 round 独立。验收必须比较无技能、单技能和三项同持的真实普通终局值，检查 money profile 与 typed growth 的整数差、负值拒绝、重复技能不叠乘，以及 CPU/旁观无 account 不授。不得声称原 reward producer 已全还原。

---

## Func20 鱼骨与骨头

### 来源事实

- item20001/20002 均为类别 6 贵重品，ItemType 13，`ItemMoney/ItemCoin/GGet/Durable=0`，非 0x30 MyItem 身份；item 表 `ItemSkill1=20001/20002`，`ItemSkill2=30005`。
- skill20001/20002 分别为 `Trigger1/Target1/Func20`，参数 `T1/X1/Y20001/Z0` 与 `T2/X1/Y20002/Z0`，Effect/Sound 全 0；skill30005 为第二技能，`Trigger1/Func2/HP30`，说明字段与 item 文案的 15 存在冲突。
- 原 `UMsgPickupTreasure` receiver 只清理成功场景物件；未取得正常接触请求、资格、持久数量 writer 或治疗 writer，且 0x58 字节 Treasure 记录与 0x30 MyItem 不是同一身份。
- 现有账户库存以 instance record 持久，`consumeItem` 只做 owned 减一；普通 ground 业务有对象移除事务边界，但类别 6 尚无可执行取得入口。

### 采用 policy

1. 不新增 `Treasure`/0x58 记录，也不把 0x58 字段伪造为 MyItem。成功接触 ground item 时，使用账户现有库存记录，以 `itemTableId` 精确等于 20001 或 20002、类别 6 的稳定实例；若已有该定义的一个 stack，则 `ownedQuantity += 1`；没有则创建类别 6 instance，owned 1，所有未知 float/字段保持零，不复制 0x30 记录的 owner/id。
2. 事务顺序与现有 ground item 一致：服务端先验证 PLAYING、存活、contact 半径、对象存在且归属未改变；在同一 `BEGIN IMMEDIATE` 内写持久库存和 `ground_pickup_receipts` 收据，成功 COMMIT 后才从 `groundItems`/场景移除，并向成功 observer 发一次拾取事件。任一失败回滚，场景对象保留，不重试伪造成功。
3. Func20 的 `T1/T2/X1/Y` 作为来源 literal 保存在技能来源，policy 不把它们重命名为数量、治疗或猫狗资格。成功拾取只处理“数量 +1”；HP 是否恢复由 30005 的独立 Func2 消费者决定，当前不把 item 文案 15 或表 30 之一冒充最终治疗；实现该消费者后才按真实 HP 增加写入，且不能在数量事务中顺带改 HP。
4. 该账户物品可供后续真实消费/出售，但本 policy 不开放免费商城、不把价格 0 变成 BUY 资格，不接受类别 7 全量出售。消费走现有 `consumeItem`/售卖事务；持久重启后用同 instance 和 ownedQuantity 恢复。
5. 同账户多连接：库存写入以账户中最小且类别 6 的 20001/20002 稳定 instance 为 stack authority，没有时创建一个；并发拾取在 SQLite `BEGIN IMMEDIATE` 中串行。收据以 `(roomId,groundId)` 唯一，重试命中收据返回原 instance/quantity，不二次加一、不二次移除对象。CPU/无账户不写账户，不获得地面物品。

推荐最小接口：

```ts
interface GroundTreasurePickup {
  roomId: string;
  playerId: string;
  groundId: string;
  itemTableId: 20001 | 20002;
  x: number; y: number; z: number;
}

pickupGroundTreasure(...): {kind: 'picked' | 'removed' | 'rejected';
  itemTableId?: 20001 | 20002; instanceId?: number; ownedQuantity?: number}

// 同一 SQLite 事务内：
// ground_pickup_receipts(
//   room_id TEXT, ground_id TEXT, account_id TEXT,
//   item_instance_id INTEGER, owned_quantity INTEGER,
//   PRIMARY KEY(room_id, ground_id)
// )
```

真实事务写入放 `account-store.ts`/既有 ground 事务模块；battle 仅负责资格和一次成功边界。UI 只读权威库存行，沿用 `home-valuable-region-source` 的类别 6 显示；不新增假 record 或假图标来源。

### 生命周期与验收

接触、失败回滚、成功持久加一、场景移除、离场/round 清理和同库重启构成最小闭环。验收要观察 `itemTableId=20001/20002` 的 owned 增加且未改变任何 0x30 身份字段；重复接触不双加；没有正常接触时对象不消失。HP 治疗与类别 6 全量出售保持独立未完成项。

---

## Func21 战术雷达

### 来源事实

- skill13111 为 `Trigger0/Target1/Func21/X0/Y1`，说明“不被敌方战术雷达发现”；skill13112 为 `Trigger0/Target1/Func21/X1/Y0`，说明“在战术雷达上发现干扰装置的敌人”。两者 Effect/Sound 为 0。
- 两技能的 RadarA/B/C 原列均为 0，因此不能从这三个静态 attribute 推导雷达效果；只能由 Func21 的 X/Y 参数和实际 `selectedSkillIds` 决定。其它 13113/13121–13124/13131 的 Radar 值与它们不同，且函数为 Func1，不能借作 Func21 的取得或作用来源。
- 已冻结 item/pet/`PetSkill` 表没有 13111/13112 引用；当前原表目录没有 `part.dat`，验证目录也没有 `part.json`。因此不得把全局 catalog 或同类雷达部件的存在当作本技能启用来源。
- 现有 `battle-minimap.ts` 只负责场景俯视图，当前 renderer 没有玩家 tactical marker 的雷达关系消费者；世界模型也没有把隐藏与雷达资格混在一起。现有 `isHiddenByOpticalCamouflage` 仅处理光学迷彩。

### 采用 policy

1. `RoleSkillSources`/`selectRoleSkills` 得到真实 `selectedSkillIds` 后，在服务端构建每个参与者的 `radarVisibility`：
   - 拥有 13111（X0/Y1）且存活时，`jammedUntil = now + 1000` 的采用持续；重复通知不叠加，死亡/round/Leave 清除。
   - 拥有 13112（X1/Y0）且存活时，`detectorUntil = now + 1000` 的采用持续；重复通知只保持当前 authority deadline，不叠加。
   具体持续单位没有原 writer 证据，设计固定为 1 秒采用 policy；若真实技能来源没有 13111/13112，不启用。
2. tactical marker 关系先按现有模式关系：mode1/2/3 使用 team；mode4/5 使用敌对关系。对观察者只显示本队/敌我允许的对象；若目标 `jammedUntil>observer.now` 且观察者自身不具 `detectorUntil`，过滤该 marker。探测对干扰：observer 有 13112 时可看到具 13111 的目标；observer 无 13112 时看不到干扰目标。
3. 光学隐身仍由 `isHiddenByOpticalCamouflage` 独立决定；13112 不自动破解光学迷彩，13111 不自动让所有隐身可见。两个判断可组合但不互相替代。雷达只过滤 tactical marker，不隐藏 CPU/world actor，不改变伤害、AI 目标选择或世界模型。
4. 标记不新增 3D 模型、不修改 `battle-minimap` 俯视纹理；UI 在现 HUD marker 层消费 `radarVisibility`，过滤规则由 server authority 提供，不让 CPU 读取隐藏状态做泛化推测。
5. 同账户多连接各自是 participant；state 写入该 participant 的 combat/player，不使用连接 id 作为 authority。退场/死亡立即清；重连按当前 `roleSkillSources` 重算，不把上一 connection 的 deadline 当永久状态。

推荐接口：

```ts
readRadarModifiers(skillIds: readonly number[]): {
  jammer: boolean;
  detector: boolean;
};

applyRadarEffect(player: RadarParticipant, now: number): boolean;
clearRadarEffect(player: RadarParticipant): void;
canObserveRadarMarker(observer: PlayerSnapshot, target: PlayerSnapshot,
  mode: number, now: number): boolean;
```

`readRadarModifiers` 只消费 `selectRoleSkills` 的真实 ids；`canObserveRadarMarker` 是 UI 与 CPU 共用纯规则，不读取 catalog 全局技能，不读 raw RadarA/B/C 作为替代。

### 生命周期与验收

技能来源出现/消失时立即重算；到期、死亡、复活、round、Leave 清。普通双端观察需覆盖：无干扰时可见、有干扰无探测不可见、有探测可见、光学迷彩仍独立隐藏、mode1/2/3 同队可见与 mode4/5 敌对关系。不得声称原 RadarA/B/C 消费或原 server writer 已恢复。

---

## 实施顺序

1. shared worker 先确认 schema 102 是否确实需要新增 `respawnProtection?`/`radarVisibility?`；若现有 UI 可复用 invincibility 和 marker 现有字段，则不扩协议。
2. server 实现 Func19 纯倍率与账本事务测试，再接 `finish-round` 冻结来源；这是五个中唯一与账户事务直接耦合的。
3. server 实现 Func6 重生保护及 Func17 纯选择/最终死亡一次入口，复用现有 `life.ts`、`start.ts`、`passive-skill-copy.ts`。
4. server 实现 Func20 地面类别 6 拾取事务及持久 inventory，接入现有 ground 对象生命周期。
5. server/shared 实现 Func21 `radarVisibility` 规则，UI 只做 marker 过滤与既有 HUD 消费；FX 不新增雷达特效。

## 统一完成条件

每个子项都要有“来源事实、采用 policy、refusal、success、trueclock、transaction/lifecycle、snapshot/UI”七项。实现完成不等于原 342 技能全量 source 恢复，也不能借本轮关闭 FUNC-06/17/19/20/21 父项或 342 coverage。现有 `invincibility`、`passive-skill-copy`、`computeResultAward`、ground/inventory 事务和结算 receipt 必须保持原行为；未确认的未知表字段不猜、不写、不补默认。

## Known Issues

- 30001 没有 item/pet 直接来源，原角色默认重生 flag 未确认；当前重生保护是采用 policy，X3/Y20 单位不明。
- Func17 的主动/条件复制、候选原集合、Effect12 producer 和永久保存规则未恢复。
- Func19 的原 reward producer 未取得；百分比取整、同账户多连接倍率来源采用本文规则，不声称原服务端等价。
- Func20 的正常接触请求、拾取资格、30005 治疗量及类别 6 全量出售未恢复。
- Func21 的原 RadarA/B/C 消费、writer 及 13111/13112 取得入口未恢复；1 秒期限及敌对过滤是采用 policy，光学隐身独立且不互相替代。已知 item/pet/`PetSkill` 无引用且现无 `part` 冻结表，不能把同类雷达部件自动映射为这两项技能来源。
