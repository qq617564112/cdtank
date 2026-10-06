# 六种付费消耗品的定义与表现

商城六种消耗品从空库存购买后，仍按`itemTableId`选择原定义、D2图标、技能和效果。分配的实例ID只用于快捷槽、归属与持久消费。

`tests/consumables-purchase-effect.cts`导入显式原角色资料夹具，设置金钱1000、星币1000，库存初始为空。每种物件分别用金钱和星币购买一个实例，将第二个实例配置到槽4，通过普通Digit5解析与现有正式道具消费入口使用。六个被使用实例ID均与定义ID不同。SQLite账户CAS只消耗对应实例，第一份库存保持数量1；最终余额870/890。

| 原物件ID | D2图标资产 | 首槽技能 | Effect | Sound | 实际绘制节点数 |
| --- | --- | --- | --- | --- | --- |
| 1 | `ui/regions/57/0.png` | 1 | 11 | GA15 | 5 |
| 2 | `ui/regions/57/1.png` | 2 | 11 | GA15 | 5 |
| 4 | `ui/regions/57/3.png` | 4 | 106 | SE38 | 7 |
| 6 | `ui/regions/57/5.png` | 6 | 110 | SE42 | 7 |
| 7 | `ui/regions/57/6.png` | 7 | 113 | SE45 | 7 |
| 8 | `ui/regions/57/7.png` | 8 | 100 | 0 | 4 |

每行检查原`item`表的名称、说明、价格、D2、BattleUseMax、三个ItemSkill槽、三个物件效果槽，并检查对应原`skill`表的全部效果槽。技能首槽均保留Tag0/Method3，正式通知使用活`tag_efcenter`挂点。声音引用与已发布声音资产保持原绑定；技能8的`0`表示无声音资产。

购买实例经现有`applyHealingItem`、`applyAttackDrink`、`applySpeedDrink`、`applyTurnDrink`或`applyInvincibility`产生正式首槽通知，再沿`BattleSkillEffects → createSkillEffectNotifications → EffectRuntime`建立运行树。测试将树逐节点与已有原递归创建证据比较，验证实际网格绘制节点、原发布纹理资产、挂点移动后的几何变换和声音分派。饲料与饮料自然结束释放实例、网格、材质；技能8保留通知在300模拟步后释放。治疗夹具初始生命50、上限1000；移动饮料夹具显式设定属性已准备。

既有`feed-purchase-effect`、`healing-effect-life`及攻击、速度、回旋、无敌各自的效果测试保留一次性播放、停止、角色移除、复活、重叠角色与资源释放的独立证据。本测试覆盖新购买实例进入这些现有效果链。

验收命令：

```bash
npx tsx tests/consumables-purchase-effect.cts
```

证据：`recovery/output/consumables-purchase-effect.json`。

## 限制

运行几何采用NullEngine与夹具纹理像素；实际浏览器像素和设备声音播放由浏览器验收覆盖。原服务器购买资格、自用成功条件和函数分派尚未完整恢复。饮料第二效果槽Effect10/SE02的原触发仍未知，保留原绑定；本测试只播放已有证据支持的首槽。原树内嵌`ww051`没有已恢复资产，既有原缺失描述符证据与运行行为保持不变。
