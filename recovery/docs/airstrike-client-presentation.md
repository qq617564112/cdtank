# 道具13空袭 Web 表现合同

对应 FUNC-16/FUNC-15 与 M4-10 的 item13/skill13→3013→3012 空袭链。权威执行、库存 CAS、X20→20 服务端 tick、中心 XZ 采用、单次范围结算与 hit/direct HP 属共享与服务端合同；Web 侧只消费既有房间事件与技能通知，不改战斗结果。业务规则见 `airstrike-client-business-design.md`。

## 直接源事实

item13 的 ItemSkill1 为 skill13，首槽 Effect10/SE02/Method3；skill3013 首槽 Effect60/SE32/Method1；skill3012 无效果与声音字段。roleId0 的 Play 通知按原 488291 分支把 EffectN 格式化为 `_root\online\%03d`、以 `[worldX,0,worldZ]` 和末参数 1 启动世界树，该分支不查角色、不走保留分支、不播放技能声音；角色分支不消费位置字段，缺失角色或绘制对象不回退世界分支。EffectMethodN 只有表 loader 证据，原 Play handler 未读取，也无其它已恢复消费者，故不作为声音接线依据。已发布 `audio.json` 的 `soundIds`/`sounds` 含 SE02/SE32 及对应 WAV，`effect-library.json` 含 `_root\online\010`/`_root\online\060` 世界树；这些是本片直接复用的事实来源。

## 普通获取与配置

`sourceShopItemCategory` 与 Home 物品页都复用 `classifyItemId`/`classifyInventoryCategory` 的原范围判定，item13 落 Item 类别（`classifyItemId(13)=1`，`classifyInventoryCategory(13)=1`），无需在 `shop-item-category.ts`、`shop.tsx` 或 `home-inventory.tsx` 写 item13 特判。普通玩家在道具商店走正常 QUERY/BUY（原正价 40 金币/20 软星币，走现有余额与确认显示），在 Home 物品页把它拖入快捷槽；物品页四个槽对应 ReqKitbag 槽4–7（战斗输入键5–8），槽显示、选择、ASSIGN/CANCEL、数量显示及每局初值（`battleUseMax=1` 夹取）沿用现有 authority，不新增库存状态、poll、HTTP 回放或本地预测消费。

## CPU 配置

`CpuLoadoutEditor` 读取 `/combat-catalog.json` 后把 item13 与 `CPU_LOADOUT_ITEM_IDS` 一并纳入 `items`，item 槽判定为「1–11、13 或 502」，item13 以原名称「救命啊通讯器」及 `battleUseMax=1` 出现在等待室 CPU 道具槽5–8下拉。槽2–4 只允许弹药 2007/2011，item12/501 不加入，数量上限取 `battleUseMax`，保存走 `ReqCpu CONFIGURE`。`apps/shared/combat/cpu-loadout.ts` 的 `CPU_LOADOUT_ITEM_IDS`/槽5–8判定含13，`configureRoomCpuLoadout` 属共享/服务端合同。

## 房间事件与效果消费者

`RoomFeed` 只把同房 `MsgRoomEvent` 交给回调，不按 `type` 过滤，新增 `airstrikeImpact` 无需改动。`BattleSkillEffects.event` 在保留原有 `playSkillEffect`/`stopSkillEffect` 消费之外，对本功能承担一项采用业务政策：确认施放的 `itemUsed` 事件（`playSkillEffect.skillId=13`）与到期的 `airstrikeImpact` 事件（`playSkillEffect.skillId=3013`）在 `roleId=0` 时各播放一次该技能首槽源 WAV，位置取事件权威 `event.x/y/z`（center）而非角色后续位置。`skill-effect-notifications.ts` 对 roleId0 沿用 `_root\online\{effectId:03d}` + `[worldX,0,worldZ]`、flag1 启动世界树，新增的 `worldSound` 只是读取同一首槽 `sound` 字段并交给既有 world 位置声音 backend，不改变旧 roleId0 raw 通知合同：只有上述两个正式事件会触发声音，其它 roleId0 通知仍静默。声音走既有 `EffectRuntime.playSceneSound`/`EffectSkillSound` 单次非 loop WAV 与已发布 SE02/SE32 资源，复用既有 owned audio cleanup，不新增 synth 声、共享协议、`xBits/zBits` 字段或调度框架。成功 `itemUsed` 已由 `BattleItemInventory.event` 触发一次重新读取权威库存，不做本地扣减；命中沿用 `hit` 事件经 `BattlePlayers.damage` 显示原伤害数字图片，`airstrikeImpact` 只是本功能的房间事件类型名，不新增内部字段、不重播伤害。

## 发布资源核对

已发布目录可直接满足本片消费，无需新增或替代资源：

- `effect-library.json` 含世界根 `_root\online\010`（skill13 首槽 Effect10）与 `_root\online\060`（skill3013 首槽 Effect60），均为 type0 容器树，`EffectRuntime` 已按 `/^_root\\online\\\d+$/` 预载其引用纹理/模型/粒子。
- `audio.json` 的 `sounds`/`soundIds` 均含 `SE02` 与 `SE32`，对应已发布 `audio/sound/SE02.wav`、`audio/sound/SE32.wav`。
- item13 图标 `data\ui\daoju\00013.tga` 在 `daoju0` imageset 的两套区域（`ui/regions/24/12.png`、`ui/regions/57/12.png`）均存在。

`_root\online\010`、`_root\online\060` 子树内没有 `soundControls` 声音条目（`060` 仅有一个名为 `sound` 的空 type0 容器节点），与 roleId0 世界分支不播放技能声音的原 handler 一致；SE02/SE32 由技能表首槽 `sound` 字段另行驱动，不由效果树内声音节点驱动。这两棵树的实际绘制提交、音效与裁剪行为仍以既有 world consumer 为准，本片不重造 geometry、不伪造缺失资源。

## 改动边界与生命周期

共享/服务端文件、Battle/battle-players 及其它已集成伪装文件、`shop-item-category.ts`、`home-inventory.tsx`、`home-inventory-source-list.tsx`、`room-feed.ts` 与 `render/effects/world` 消费者保持原状；本片只改 `battle-skill-effects.ts`、`skill-effect-notifications.ts`、`skill-effect-runtime.ts` 的空袭本功能接线，并复用 `EffectRuntime.playSceneSound`/`EffectSkillSound` 与 `audio/battle-sound.ts` 既有普通声源。暂停、离房、终局、再战沿用 `SkillEffectNotifications.clear`/`clearRole` 与 `EffectRuntime.clearRoundEffects` 的资源归属，无历史快照 replay、本地 TTL、本地数量/伤害或 snapshot 重放。

## 待验收

普通玩家道具商店 QUERY/BUY item13、我的家槽5–8 ASSIGN/CANCEL/数量、CPU 槽5–8 配置并重启恢复、战斗中一次合法空袭的 `itemUsed`+Effect10/SE02 世界树与一次 SE02、20 tick 后 `airstrikeImpact`+Effect60/SE32 世界树与一次 SE32、原伤害数字图片、数量消费与库存刷新、暂停/离房/终局/再战清理仍需实测。本片未运行测试、构建、类型/lint、浏览器或任何自动验证，上述结论来自已发布目录与既有 consumer 的静态核对。

## 局限与已知问题

- 声音位置采用事件权威 `event.x/y/z`，非角色后续位置；`EffectMethodN` 仍未证实，本片不据此推断更细的声音行为。
- 既有 `tests/effects-skill13-world-browser.mjs` 按旧「roleId0 世界分支静默」合同断言 skill13 无外层 SE02，本片采用的 itemUsed13/airstrikeImpact3013 声音政策会使该断言过时；该 fixture 归其所有者更新，本片不修改也不运行测试。
- 上述全部结论来自静态核对，实际施放、声音播放、绘制提交与清理均未执行验证。
