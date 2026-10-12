# 2010 雷达干扰弹运行时

`apps/server/src/battle/items/ammo-radar-jam.ts` 落地 M2-02/M4-10 的 2010 普通玩家业务链。
来源事实与采用规则分列；本文件不声称原 4008 执行器已恢复。

## 来源事实

- 原 `combat-catalog.json` 中 `item2010` 为雷达干扰弹，`ItemType` 3、`BattleUseMax` 15、
  `skillIds` 2010/4008、价格字段 0/0、`GetMethod` 0。
- 原 `skill2010` 为 Trigger0/Target1/Range0，`Delay` 23、`MaxBullet` 4、`LoadTime` 100，
  RadarA/B/C 均 0，FuncType1 T0。
- 原 `skill4008` 为 Trigger8/Target1/Range1，RadarA/B/C 均 999，首效果 13/SE14，
  FuncType1 T15。
- `dropitem` 类别 2 的数量 1 档为 `021`，`ItemID=obj05008`、`ItemTexture=A`、
  `SoundFile=GA21`、`EffectFile=44`；现有 `selectDropVisual` 可直接选用。

## 采用规则

- 合法普通 2010 真实射击命中仍存活、`hp > 0` 的敌对目标，并通过现友伤/免伤/伤害接纳门禁后，
  目标获得 15 服务器秒雷达干扰期限。
- 对同一目标连续命中只刷新 `expiresAt`，不叠倍率；未击中、免伤、友伤、死亡目标或非 2010
  弹药不作用。
- 该期限只影响本人 tactical 敌方 player markers：本人和同队保留；具有既有 Func21
  `13112` detector 关系的观察者可解除 2010 干扰显示。它不改变 optical invisibility、
  玩家可见 3D 模型、movement/aim/fire 权限或 CPU 视觉瞄准。
- 期限保存在 `PlayerState.radarJam?:{skillId:4008;expiresAt}`，不新增 attribute 资格、
  `specialFlag12` 语义、物件 ID 或第二套生命周期框架。快照由当前真实 server clock 投影
  `radarJammed` 布尔。
- 到期、真实 death/respawn、Leave、finish、new round、loading 清理该状态。普通 `item3`
  宠物注射剂在现 CAS 消费成功后才清 2010 干扰；保存失败或无异常时不消费，也不清正面饮料或
  无敌状态。
- 被接纳命中的一次绘声只由该次 `hit` 事件承载：`hit` 携带
  `shotPlayerResult.itemId=2010` 与 `playSkillEffect.skillId=4008`，消费者据此走一次
  SkillNotification Effect13/SE14；`radarJammed` 只通知状态，不另发第二条 4008 效果。
- 取得只走 mode5 现权威 BREACH“目标毁灭→普通 contact40→AccountAcquire receipt”链：
  既有 `BREACH_POOL` 明确加入精确 `item2010`，总体 drop probability 0.5 保持，池内各项
  uniform 作为新增采用规则。拾取只入 owned；初次未装槽 `battleQuantity=0`，玩家正常退出/
  等待后通过 Home weapon 槽 1..3（Battle 2..4）配置，15 上限沿用原 `BattleUseMax`。
  现有 beforeFire/consume/CAS 流程不新增第二消费路径，失败不改库存。

## 生产链

`World.simulateRoom` 在现有 `resolveShotPlayerHit` 后处理 2010：只有普通伤害接纳后目标仍
`alive/hp>0` 且非友方才 `startAmmoRadarJam`，并把 4008 一次性效果挂到本次真实伤害产生的
`hit` 上。`advanceAmmoRadarJam` 在每 tick 现有状态推进中清除到期；respawn、
`commitPlayerDeath`、Leave、`startRoom`、`beginRoomLoading`、`finishRoom` 均清状态。
`acceptBattleInput` 在物品分派前用同一次真实 `now` 推进雷达期限：已到期对象先清除，仅剩到期
异常时 `item3` 走无异常拒绝且不扣量；未到期状态保留到注射剂 CAS 成功后才清。
`applyPetInjection` 在 CAS 成功后才清该状态。

`rooms/snapshot.ts` 只把当前 `radarJam.expiresAt` 与真实 `now` 比较后投影布尔
`radarJammed`，不编造 clock 或 clientTime。shared/UI 由独立 worker 手工追加可选 Boolean 并在
`canObserveRadarMarker` 消费。

## 未实测

本文件记录静态实现与采用规则，不声称 tests、浏览器、build、typecheck、lint、native、
实际对局或持久验收已通过。
