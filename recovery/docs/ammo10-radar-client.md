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

## 接口

- shared schema version107，`MsgRoomSnapshot/PlayerSnapshot` 在现有最大 `id44` 后追加
  optional `id45` Boolean `radarJammed`。
- `canObserveRadarMarker(observer, target, mode, radarJammed?)` 在原有 Func21 关系前保留旧默认
  行为；省略第四参时读取 `observer.radarJammed`。
- `hud-minimap-state.ts` 与当前 `battle-minimap-renderer.ts` 的 tactical marker 消费同一 helper。
- 合格 2010 命中携带同受害者 roleId 的 4008 首槽 `playSkillEffect` 时，Effect13/SE14 只沿既有
  `playSkillEffect -> BattleSkillEffects -> SkillEffectNotifications` 通道呈现一份；该命中不再
  重复调用旧 2010 `showPlayerResult`。没有该通知的普通 2010 命中仍沿原表现。`radarJammed`
  状态事件只报告到期状态，不承载技能效果。

## 未实测

本客户端片未运行浏览器、构建、类型检查或生成器，也未执行普通双端 2010 命中、15 秒实时过期、
死亡/复活/终局/Leave 清理或像素/声音验收；这些边界由服务端集成批次和验收批次确认。
