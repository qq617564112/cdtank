# 五模式地面道具掉落与拾取运行时

M2-10 掉落子项的集中规则记录。原客户端通信、dropitem 表字段与既有实测证据仍见
`ground-item-business-design.md`；本文件只收敛当前正式采用行为，避免在多个局部文档
重复同一套规则。源码接线见 `ground-items-runtime.md`、`ground-item-world-runtime.md`、
`ground-item-account-runtime.md`、`ground-item-client-presentation.md`。

## 目标来源与触发

- 模式 1–4 的当前地图原 Breach 放置作为 `sceneObjects` 可破坏实例进入目标池，含 mode2。
  模式 5 仍以 `objectives` 的单一 Breach 实体为目标。
- Castle 保持原 mode1/mode2 规则；Castle、Plant、Crush 都不掉落地面的原 Breach 掉落池。
- 射击即时查询与 projectile 击毁都接到每个真实 placement 的击毁，按
  `placement + destroyedAt` 去重一次；同一 placement 的一次击毁不重复掷骰。
- mode5 终局判定前仍产出该次掉落实体；目标之后建立新的 `destroyedAt` 重生并再次击毁时，
  新击毁可重新掷骰，旧同值不会重放已产生或已领取的实体。

## 概率、池与参数

- 五个模式统一采用原先 mode5 的 50% 概率。
- `runtime.values.breachDropOrder` 构成12项池，顺序为 `[1 宠物饲料, 2 大包饲料,
  2010 雷达干扰弹, 20001 鱼骨, 20002 骨头, 9 光学迷彩, 10 南瓜变身, 11 木桶变身,
  501 1UP, 502 建筑工具, 3006 精品饲料罐头, 3007 定时闹钟]`，触发成功后等概率各 1 份。
- 参数取 `shared/content/definitions/index.json` 的 `rules.groundDrops`：
  `chance = 0.5`、`quantity = 1`、`lifetimeSeconds = 30`。
- 原服务端按模式的概率与数量来源仍缺；上述是延续同一原 Breach 与既有闭环的采用项目规则，
  不冒称已证原行为，也不阻塞实现。

## 地面实体生命周期

- 所有地面实体，包括底层 `DISCARD`，存活 30 秒。服务端以实体 `createdAt` 与 server now
  比较，推进时先删除到期实体再扫描拾取。
- 原 `VanishTime` 的业务含义未确认，采用独立的 30 秒；未从该字段反推原始消失规则。
- 快照投影、`groundItemRemoved`、开局与换轮清理沿原有 ground 链，不新增 schema 字段或
  RPC。正式战斗页不提供丢弃控件。

## 拾取资格

- 真人按真实已选 pet JSON 的 `petType` 判定：猫 `PetType 1` 可拾鱼骨 `20001`，狗
  `PetType 2` 可拾骨头 `20002`。错误种类或未选宠物不能拾取这两件，物件保留给后续合格玩家。
- 其它掉落物品不限制宠物种类。
- `20002` 原说明有“鱼骨”复制文案冲突；身份按实际 ID、`primary` 技能与 `PetType` 推断，
  不把该文案当成已证服务端身份来源。

## 成功拾取

- 两件宝物成功领取才入库存 +1，并为实际拾取者回血 15。参数取物品 JSON
  `runtime.values.pickupPetType` 与 `runtime.values.pickupHealing`。
- 生命走原健康入口并 clamp 到玩法当前 `maxHp`。满血仍取得物品；`lastStand` 不回血；
  拾取失败不治疗、不移除实体。
- 同账户其它连接只刷新库存，不为那些连接回血。
- 原文案 15 与 `ItemSkill2=30005` 的 `HP 30` 不一致，因此拾取 15 与既有手动自用技能 30
  分开。手动使用继续按原 CAS 扣一份治疗需求与两量单减。

## 本局快捷槽

- 真正拾取时，新未装实例自动填入本局正确栏的首个空槽：Battle2..4 武器/陷阱，
  Battle5..8 消耗/宝物。
- 不覆盖已满槽，不自动使用，不自动切武器。满栏仍入库，但本局没有可用槽。
- 自动填入只改变当局角色的 hotkeys，库存 RPC/HUD 可见；不改保存的账户配置。
- 已有槽实例按原 `remainingBattleQuantity` / `roundUse` 余量补数，不重置本轮已用额度。
- 跨连接 reconcile 不自动填槽。CPU 采用同一套资格与本局槽规则，其本局 local 库存仍不持久化。

## dropitem 表

- 原 `dropitem` 14 行仍只是类别/数量档位到原模型、贴图、声音与 `Effect 44` 的映射，
  不作为概率来源。
- 持久 receipt、原声音、地面消失与同账户库存广播共用原链。

## 验证边界

本批为静态实现与采用规则登记。原服务端按模式的概率/数量来源、`VanishTime` 原语义未取得；
新增七件取得仍待普通对局、双端、持久与高清实测；资源publisher执行不构成游戏实测。
