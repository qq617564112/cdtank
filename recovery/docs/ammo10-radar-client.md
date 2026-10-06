# 2010 雷达干扰弹客户端与战术标记

## 直接来源

- skill4008 为 `Trigger8/Target1/Func1`，`T15`，RadarA/B/C 原列均为 `999`。
- 首槽 Effect13、SE14；原 `432951` 的 Radar 处理不能把 Radar 列属性相加。
- 2010 不通过 zeroShop 免费取得；正式入口是普通拾取/拥有后的 Home category2 配置。

## 采用规则

服务端确认合法 2010 普通开火命中存活敌对目标后，写入 15 server 秒雷达干扰期限，并在
`PlayerSnapshot.radarJammed` 投影当前是否仍在该期限内。字段是单一 Boolean，不暴露结束时间；
期限结束、死亡、复活、终局、再战、Leave 和换局清理由服务端状态负责。

客户端只在战术小地图标记关系中消费该 Boolean。被 2010 干扰的观察者自身、同队参与者、
环境、目标物、己方地面对象和世界/3D 可见性不受影响；只有敌对 participant tactical marker
在该观察者仍有 `radarJammed` 时隐藏。既有的 13112 detector 可抵消 2010 雷达干扰和
13111 Func21 jammer，但不能解除 optical camouflage。本人和 mode1..3 同队标记始终可见。

## 取得与消费

原 `item2010` 为 `ItemType` 3、`ItemMoney/ItemCoin/GGet` 均 0、`BattleUseMax` 15、`skillIds`
2010/4008；正式入口不开放免费 Shop 或 gift。采用规则走 mode5 现权威 BREACH“目标毁灭→普通
contact40→AccountAcquire receipt”链：既有 `BREACH_POOL` 精确加入 `item2010`，总体掉落概率
保持 0.5，池内五项 uniform，因此每项无条件概率 0.1。`dropitem` 类别 2 数量 1 档为 `021`，
`ItemID=obj05008`、`ItemTexture=A`、`SoundFile=GA21`、`EffectFile=44`。

拾取只入 owned；初次未装槽时 `battleQuantity=0`。玩家正常退出/等待后通过 Home weapon 槽 1..3
配置为 Battle 键 2..4，15 上限沿用原 `BattleUseMax`，沿既有 beforeFire/CAS 单一路径消费，
失败不改库存、不新增第二消费路径。到期资格由真实 server clock 判定：`acceptBattleInput` 在
物品分派前沿用同一 `now` 推进期限，已到期对象先清除，仅剩到期异常时普通 `item3` 走无异常拒绝
且不扣量；未到期状态保留到注射剂 CAS 成功后才解除，不改正面饮料或无敌。

## 接口

- shared schema version107，`MsgRoomSnapshot/PlayerSnapshot` 在现有最大 `id44` 后追加
  optional `id45` Boolean `radarJammed`。
- `canObserveRadarMarker(observer, target, mode, radarJammed?)` 在原有 Func21 关系前保留旧默认
  行为；省略第四参时读取 `observer.radarJammed`。
- 当前 `battle-minimap-renderer.ts` 的 tactical marker 以三参数调用该 helper，默认读取本机
  `observer.radarJammed`；共享谓词与 legacy `hud-minimap-state.ts` 消费同一 helper。
- 合格 2010 命中携带同受害者 roleId 的 4008 首槽 `playSkillEffect` 时，Effect13/SE14 只沿既有
  `playSkillEffect -> BattleSkillEffects -> SkillEffectNotifications` 通道呈现一份；该命中不再
  重复调用旧 2010 `showPlayerResult`。没有该通知的普通 2010 命中仍沿原表现。`radarJammed`
  状态事件只报告到期状态，不承载技能效果。
- 该 marker 过滤只作用于战术小地图 player marker，不改变世界/3D 可见性、CPU 观察/目标选择、
  移动、瞄准或开火权限。

## 未实测

本客户端片未运行浏览器、构建、类型检查或生成器，也未执行普通双端 2010 命中、15 秒实时过期、
死亡/复活/终局/Leave 清理或像素/声音验收；这些边界由服务端集成批次和验收批次确认。
