# 2010/4008 雷达干扰弹消费者

M2-02/M4-10 的 2010 玩家业务链见
[ammo10-radar-runtime.md](ammo10-radar-runtime.md)。本文保留 2010/4008 的原表来源事实，
并记录旧缺口文件被当前采用规则取代后的边界。

## 来源事实

- 原 `item2010` 雷达干扰弹：`MoneyPrice/TokenPrice` 均 0、`GetMethod` 0、`BattleUseMax` 15、
  `ItemType` 3、`skillIds` 2010/4008、首效果 53/GA08。
- 原 `skill2010` 干扰果酱：Trigger0/Target1/Range0，`Delay` 23、`MaxBullet` 4、`LoadTime` 100，
  RadarA/B/C 均 0，FuncType1 T0。
- 原 `skill4008` 干扰果酱B：Trigger8/Target1/Range1，RadarA/B/C 均 999，首效果 13/SE14，
  FuncType1 T15。
- 完整原 432951 既有合同不把 RadarA/B/C 作为属性被动或小地图资格写入；原 4008 施加
  Radar 字段的写地址和期限 writer 尚未取得。

## 采用与限制

2010 不进入免费 Shop 或 gift。普通取得使用 mode5 既有 BREACH 掉落链，池内精确新增
`item2010`；普通命中使用独立实服务器 15 秒期限和快照布尔，不把 4008 的 999 列作为属性。

原客户端行为测量、原 native 复跑和实际对局验收尚未执行。
