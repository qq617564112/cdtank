# 道具13空袭 Web 表现合同

对应 FUNC-16/FUNC-15 与 M4-10 的 item13/skill13→3013→3012 空袭链。权威执行、库存 CAS、X20→20 服务端 tick、中心 XZ 采用、单次范围结算与 hit/direct HP 归 root 与共享合同；本片只接线 Web 界面与既有房间事件、技能通知消费者，不改战斗结果。业务规则见 `airstrike-client-business-design.md`。

## 直接源事实

item13 的 ItemSkill1 为 skill13，首槽 Effect10/SE02/Method3；skill3013 首槽 Effect60/SE32/Method1；skill3012 无效果与声音字段。roleId0 的 Play 通知按原 488291 分支把 EffectN 格式化为 `_root\online\%03d`、以 `[worldX,0,worldZ]` 和末参数 1 启动世界树，该分支不查角色、不走保留分支、不播放技能声音；角色分支不消费位置字段，缺失角色或绘制对象不回退世界分支。因此空袭只复用世界位置分支，不新增声音或效果类型。

## 普通获取与配置

`sourceShopItemCategory` 与 Home 物品页都复用 `classifyItemId`/`classifyInventoryCategory` 的原范围判定，item13 落 Item 类别（`classifyItemId(13)=1`，`classifyInventoryCategory(13)=1`），无需在 `shop-item-category.ts`、`shop.tsx` 或 `home-inventory.tsx` 写 item13 特判。普通玩家在道具商店正常 QUERY/BUY item13（原正价 40 金币/20 软星币，走现有余额与确认显示），在我的家物品页把它拖入快捷槽；物品页四个槽对应 ReqKitbag 槽4–7，即战斗输入键5–8，槽显示、选择、ASSIGN/CANCEL、数量显示及每局初值（`battleUseMax=1` 夹取）全部沿用现有 authority，本片不新增库存状态、poll、HTTP 回放或本地预测消费。

## CPU 配置

等待室 CPU 道具槽5–8的商品集合是本片唯一需要改的 Web 行为：`CpuLoadoutEditor` 在读取 `/combat-catalog.json` 后把 item13 与 `CPU_LOADOUT_ITEM_IDS` 一并纳入 `items`，`allowed` 的 item 槽判定由「1–11 或 502」扩为「1–11、13 或 502」，使 item13 以原名称「救命啊通讯器」及 `battleUseMax=1` 出现在槽5–8下拉。槽2–4 仍只允许弹药 2007/2011，item12/501 不加入，数量上限继续取 `battleUseMax`。保存仍走 `ReqCpu CONFIGURE`；`apps/shared/combat/cpu-loadout.ts` 与服务端 `configureRoomCpuLoadout` 归 root 维护，其 `CPU_LOADOUT_ITEM_IDS`/槽5–8判定需在本批加入13，本片只读该常量、不改共享或服务端文件。

## 房间事件与效果消费者

`RoomFeed` 只把同房 `MsgRoomEvent` 交给回调，不按 `type` 过滤，新增 `airstrikeImpact` 无需改动。`BattleSkillEffects.event` 只消费 `playSkillEffect`/`stopSkillEffect` 字段，`skill-effect-notifications.ts` 对 roleId0 用 `_root\online\{effectId:03d}` + `[worldX,0,worldZ]`、flag1 启动世界树，因此 skill13 首槽 Effect10 与 skill3013 首槽 Effect60 都走同一条既有分支，无需改动这两个文件，也不新增 `SkillEffect` 类型、`xBits/zBits` 协议字段或调度框架。成功 `itemUsed` 已由 `BattleItemInventory.event` 触发一次重新读取权威库存，不做本地扣减；命中沿用 `hit` 事件经 `BattlePlayers.damage` 显示原伤害数字图片，`airstrikeImpact` 只是本功能的房间事件类型名，不新增内部字段、不重播伤害。

## 发布资源核对

已发布目录可直接满足本片消费，无需新增或替代资源：

- `effect-library.json` 含世界根 `_root\online\010`（skill13 首槽 Effect10）与 `_root\online\060`（skill3013 首槽 Effect60），均为 type0 容器树，`EffectRuntime` 已按 `/^_root\\online\\\d+$/` 预载其引用纹理/模型/粒子。
- `audio.json` 的 `sounds`/`soundIds` 均含 `SE02` 与 `SE32`，对应已发布 `audio/sound/SE02.wav`、`audio/sound/SE32.wav`。
- item13 图标 `data\ui\daoju\00013.tga` 在 `daoju0` imageset 的两套区域（`ui/regions/24/12.png`、`ui/regions/57/12.png`）均存在。

`_root\online\010`、`_root\online\060` 子树内没有 `soundControls` 声音条目（`060` 仅有一个名为 `sound` 的空 type0 容器节点），与 roleId0 世界分支不播放技能声音的原 handler 一致；这两棵树的实际绘制提交、音效与裁剪行为仍以既有 world consumer 为准，本片不重造 geometry、不伪造缺失资源。

## 未改动与生命周期

未新增或修改共享/服务端文件、Battle/battle-players 及其它已集成伪装文件、`shop-item-category.ts`、`home-inventory.tsx`、`home-inventory-source-list.tsx`、`room-feed.ts`、`skill-effect-notifications.ts`、`battle-skill-effects.ts` 与 `render/effects/world` 消费者，因为它们在 item13 上已按通用范围与 roleId0 世界分支正确工作。暂停、离房、终局、再战仍走既有 `SkillEffectNotifications.clear`/`clearRole` 与 `EffectRuntime.clearRoundEffects` 的资源归属，不为本功能加历史快照 replay 或本地 TTL。

## 待验收

普通玩家道具商店 QUERY/BUY item13、我的家槽5–8 ASSIGN/CANCEL/数量、CPU 槽5–8 配置并重启恢复、战斗中一次合法空袭的 `itemUsed`+Effect10/SE02 世界树、20 tick 后 `airstrikeImpact`+Effect60/SE32 世界树与原伤害数字图片、数量消费与库存刷新、暂停/离房/终局/再战清理仍需实测。本片未运行测试、构建、类型/lint、浏览器或任何自动验证，上述结论来自已发布目录与既有 consumer 的静态核对。
