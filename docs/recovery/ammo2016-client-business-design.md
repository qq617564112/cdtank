# 道具2016「红包拿来」普通弹药客户端业务设计与服务端实现合同

FUNC-02（4014）／item2016／M4-10-I2016。本文从已保存的 item/skill 原表、原 `4014 → 025/SE50` 表链与有限模块实证、已发布 combat 目录，以及现有普通弹药链建立正式实现合同。原 `025` stop writer／原 SourceTree 自然 release 仍未恢复，故本文明确区分直接源事实、Web 采用规则与已存在的有限模块证据，不声称原执行器等价。

## 直接源事实

| 范围 | 原来源事实 |
| --- | --- |
| item2016 | 分类 3「红包拿来」；`ItemMoney=50`、`ItemCoin=50`、`BattleUseMax=30`；`skillIds=[2016,4014,0]`；首槽 `53/GA08/tag0/method3`，次槽 `0/0/tag6/method3`。 |
| skill2016 | `Trigger0/Target1/Range0`，普通持有技能，不是命中结果技能；`4014` 才是 Trigger8 结果技能。 |
| skill4014 | `Trigger8/Target1/Range1`、FuncType2、HP0；首槽 `effectId=25/sound=SE50/tag0/method3`。 |
| 025 树 | 完整 11 节点、10 个 drawable；含 `2807 type6 lifetime0`。`controller0` 在 `0..0.5s` 以 1000/s 连续发射、capacity30、particlelife1；`controller1` 从 `0.5s` 起 emit0 且 end0。树无 type4 声音节点。 |
| 025 资源身份 | 原文字 hbnl0、红包、gongji1 与 dian 的解码 RGBA 与发布 PNG 逐字节一致；SE50 原 WAV 与发布 WAV 逐字节一致，时长 `0.5238095238095238s`。 |
| SE50 | 原 WAV 精确；现 skill sound backend 消费，不为 2016 新增声音字段。 |
| 025 stop | 当前恢复范围没有正式 `025` stop caller/writer；visible content 结束不等于原 tree release。 |

以上字段保持原值。已发布 combat 目录已包含 item2016 与 skill2016/4014，实现只读取，不改目录字段。`4014` 的 HP0 是原表结果技能字段，本文不据此推导原 damage 公式；普通现 damage 沿既有采用链。

## 正常玩家状态

- 取得前：账户无 `2016` owned 实例；Home 武器页 item2016 不在列表，武器槽 2..4 不含 `2016`，槽 1 仍为默认 `2001`。
- 取得后：普通商城 item 分类按原两价 `50/50` 可购；成功 `BUY` 生成 owned 实例，Home 武器页按现 category2 列出该实例。
- 配置后：普通 `ASSIGN` 到武器槽 2..4 后进入战斗，槽 1 保持默认 `2001`；本局数量按 `min(owned, BattleUseMax30)` 初始化。
- 选中与开火：普通 `class3` 选弹接受精确 owned 实例、类别 3、`battleQuantity>0`；`beforeFire` 先持久 `CAS` 消费，成功后携带 `itemId=2016` 发射，权威命中写 `shotPlayerResult.itemId=2016`。
- 命中后受害者：经 `4014` Trigger8 首槽挂一份 `025/tag0/retention0` 并播 `SE50` selector1；remote scene endpoint 与 scene 声音资格沿用同一结果分派。

## 采用业务规则

### 取得、配置与消费

1. 精确 `2016` 加入现 `consumableShopItems`；普通 `Shop QUERY` 返回，`Shop BUY` 仍走现账户 `BEGIN IMMEDIATE` 原子事务，`MONEY`/`TOKENS` 二选一、两价均正 `50`、`quantity` 1..10、余额不足拒绝、同 `requestId` 重放返回既有 `shop_purchases` receipt，不二次扣款，成功才创建 owned inventory。价格、图标、说明、容量全部读已发布 catalog，不新增 API、schema 或免费 grant。
2. Home 侧沿用现 category2 物品列表与现 `ASSIGN`；武器槽 2..4 可用，槽 1 仍是默认 `2001`。
3. Ready/开局按现 `initializeBattleQuantities` 以 `min(owned, BattleUseMax30)` 初始化本局数量。
4. 普通 `resolveItemHotkey` 对 `classifyItemId===3` 的槽 2..4 产生 `selectAmmo`；`confirmAcceptedAmmoSelection` 写 `selectedAmmoSlot`/`currentAmmoTableId` 并调用既有技能重算。选择失败恢复原槽位与当前弹种，不消费。
5. `beforeFire` 的 `consumeConfirmedAmmo` 先持久保存，再扣本局 `ownedQuantity/battleQuantity`、更新 `bulletCount` 并发 `ammoConsumed`；持久失败或库存竞争不射击、不扣本局量。成功后 `fireProjectile` 携带 `ammoItemId=2016`。
6. 命中玩家在同一 `hit` 事件写 `shotPlayerResult={itemId:2016,critical:...}`；`Battle` 命中分派调用 `TankShotPlayerResult.showPlayerResult`，白名单精确加入 `2016`，不改其它弹种资格。

### 结果与场景

1. 受害者端沿 item skillIds 查 Trigger8 的 `4014`，取首槽 `effectId=25/tag0` 调 `runtime.spawnAttachedEffect(victim,25,0,true,localView)`，并 `playSkillSound(victim,'SE50',1)`；本机/远端沿用现 `TankShotPlayerResult` 裁剪与 selector1 语义，retention0、一次性，不生成 retained record。
2. remote scene endpoint 沿现 `TankShotItemResult` 守卫加入精确 `2016`；scene 声音资格沿现 `BattleSound.shotItemResult` 守卫加入精确 `2016`。现本地/远端分派、其它 item、explosive2005 抑制与无效果/无声处理均保持不变。
3. 现 effect-runtime 已能加载原 `025` 树与原纹理；不新增 2016 专用事件、协议字段或 `playSkillEffect` 分支。

### 生命周期与 Web 资源政策

现有 actor/round/leave 清理足以承担房间级生命周期：`EffectRuntime.detach(view)` 移除 owner 为该 victim view 的全部实例；`BattlePlayers.reconcile` 在玩家移除或换车时调用 `effects.remove(id)`、`effects.detach(view)` 与 `skillEffects.remove(id)`；`LOADING→PLAYING`/回合切换时 `skillEffects.clear()`、`effects.clearRoundEffects()`、`players.resetRound()`；离房/stop 时 `effects.stop()`、最终 `clear()`。以上不单独证明原 `025` tree 的自然 release。

采用限定的 Web 资源回收政策，仅作用于 `EffectRuntime` 的 Web 资源保留：

- 只在精确 root `025` 的 node index `2807`（type6）上，除原 `phase===0` 分支外，接受“该节点当前已是最后一个 controller、该 controller 的 emitter 最大发射数为 0、真实 particle pool 已 drained，且 lifecycle 已不再产生未来 emission”的 active-empty 状态。
- 对 `025/2807`，`controller1` 从 `0.5s` 起 emit0/end0，粒子池在已发射粒子寿命 1s 后 drained；其余有限 drawable 结束后即可回收。025 root 无 future restart/发射，可由已有真实 timing/controller 判定，不因粒子瞬时 0、emitter 当前 0 或 stop 后变 0 就视为全部完成。
- 其它节点全部沿现既有 finite 结束 predicate，自原真实 controller/lifecycle 读取。
- 不设凭空 `2.25s` expiry、不新增 timer/polling/debug API/feature flag/retained 语义/共享 release 规则，不改原 source `duration`、lifecycle phase/state、controller、随机流或事件字段。

该处理只属于精确 `025` 不可再绘制内容的 Web 资源回收政策，不声称原 stop writer 已恢复或原 SourceTree 自然 release 等价；actor/round/leave 与 late-async cleanup 全部沿现 `EffectRuntime` 入口。

## 接线与范围

| 层 | 入口 | 采用行为 |
| --- | --- | --- |
| Shop | `apps/server/src/accounts/shop-catalog.ts` `consumableShopItems` | 精确加入 `2016`；价格/图标/说明/容量读 catalog。 |
| 账户 BUY | 现 `Shop BUY`/钱包/receipt/inventory | 原子事务，两价正 `50`，幂等重放，成功建 owned。 |
| Home / 选弹 | 现 category2 列表与 `ASSIGN`；`ClassifyItemId===3` 选弹 | 槽 2..4；槽 1 默认 `2001`；失败恢复不消费。 |
| 开火 / CAS | 现 `beforeFire → consumeConfirmedAmmo → fireProjectile` | 持久成功才发射并扣本局量。 |
| 命中 | 现 `MsgRoomEvent.shotPlayerResult={itemId,critical?}` | 写 `itemId=2016`，不新增字段。 |
| 受害者表现 | `apps/web/src/assets/tanks/shot-player-result.ts` | 4014 Trigger8 首槽 `025/tag0/retention0`，SE50 selector1。 |
| remote scene | `apps/web/src/assets/tanks/shot-item-result.ts`、`apps/web/src/audio/battle-sound.ts` | 精确 `2016` scene endpoint 与 scene 声音资格。 |
| 资源回收 | `apps/web/src/render/effects/runtime/effect-runtime-tree.ts` | 精确 `025/2807` Web quiescent 扩展，其余沿现 finite 结束。 |

复用而不改的权威链：`apps/server/src/battle/items/ammo-confirmation.ts`、`ammo-consumption.ts`、`role-ammo-request.ts`、`apps/server/src/battle/roles/ammo-magazine.ts`、`apps/server/src/world.ts`、`apps/shared/protocols/MsgRoomEvent.ts`、`apps/web/src/match/battle.ts`。已存在原来源与有限模块实证见 `combat-shot-player-result-2016-scope.md`，同链其它弹种的实现边界可参照 `combat-shot-player-result-2017-scope.md`。

## 明确未知与采用规则

| 未知 | 采用规则 | Tradeoff |
| --- | --- | --- |
| 原 `025` stop writer/caller | 不伪造 server stop 事件，仅采用限定 Web 资源回收。 | 原主动停止语义仍缺；活跃回合内回收的是 Web 资源，不是原 SourceTree release。 |
| `2807` active-empty 的资源保留 | 仅在真实 pool drained 且当前/后续 controller 不再发射后回收。 | 可能改变 Web 端不可见资源的保留时长，但不改原 timing 或事件。 |
| 原 damage 公式 | 本文不据 `4014` HP0 推导；普通现 damage 沿既有采用链。 | 原伤害数值仍未恢复。 |

## 范围边界

不新增 unit test、不运行 tests/浏览器/构建/类型/lint/exporter/native/协议生成器。不新增通用技能调度框架、哈希、防护层、兼容包装或免费取得路径。已发布资源存在时不造替代；缺失时只保留资源缺口。普通 `2016` 双端实测、原 `025` stop caller、原 SourceTree 自然 release 与 HD 仍待完成，M4-10 及 FUNC-02 父项保持未勾。
