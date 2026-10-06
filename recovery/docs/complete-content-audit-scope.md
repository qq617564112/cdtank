# 全内容交付范围

M8-04的原内容闭集来自现解码原表、布局和选定资源目录。本文对照现任务清单与已有产物定位剩余范围，不替代每条内容的原规则和真实业务证据。

| 内容 | 当前来源与目录 | 交付任务 |
| --- | --- | --- |
| 4665个选定安装逻辑路径 | `output/catalog/inventory.json`；`output/asset-usage-index.json` | M3-01/02/12 |
| 65个原布局 | `output/catalog/layouts.json` | M5-01至M5-16、UI-01至UI-65 |
| 25图原放置 | `output/web-assets/scene-placements.json` | M3-05至M3-09 |
| 26个模式地图组合、13张授权图 | `output/verified/tables/m001.json`至`m005.json`；各表7/5/7/4/3行 | M2-06至M2-13、附录MAP |
| 21战车 | `output/verified/tables/tank.json`；`combat-catalog.json.tankTypes` | M3-03/04、M6-01/03/06、附录TANK |
| 10宠物定义 | `output/verified/tables/pet.json`；`combat-catalog.json.petTypes` | M3-03/04、M6-01/04/06 |
| 342技能 | `output/verified/tables/skill.json`；`combat-catalog.json.skills` | M2-01至M2-05、M4、M6-04、附录SKILL |
| 204道具 | `output/verified/tables/item.json`；`combat-catalog.json.items` | M1、M4、M6-01/03/06、附录ITEM |
| 12字体定义 | `output/web-assets/ui-fonts.json` | M3-10、M5-16、M7-01 |

## 未完成范围

资源目录和加载入口已经建立，尚缺逐资源实际加载/表现证据及原引用缺口结论；来源索引没有重新生成以包含当前破损绑定。Breach共1144个放置中，1046个可复用已发布原库，17个等待新库发布，81个缺自身c9，详`scene-breach-catalog.md`。未授权地图的Sequence、Hook、WaterFall、Gate/Switch及部分General仍缺原入口或行为合同，详各场景入口缺口文档。其它地形、模型、纹理和声音的剩余缺口继续由M3各项记录。

`output/cpu-all-maps/summary.json`已有26组合的4人普通CPU输入各两局证据，限定50ms模拟时钟。原团队、占领、擒王、混战、破坏规则和完整奖励尚未全部恢复；该证据不覆盖实时双网页、原最大人数或高清性能。各附录MAP保持其明确验收范围，地图0002沿接受基线，不重开局部验收。

技能与道具目录全量存在，不等于全部玩法获得权威施放、成功消耗、失败不扣量、原效果、CPU和持久闭环。光学迷彩9已接普通输入/CAS、权威10秒及清理、快照/Web敌对模型隐藏与CPU观察；南瓜/木桶10/11已接普通输入/CAS、临时技能与10秒状态、原4173/4174显示字段、快照/双方替身显示、合法开火恢复及CPU有限配置；建筑工具502已接真实本队Castle5000限幅恢复、普通消费与修复事件、CPU有限配置；空袭13已接原正价Shop取得、槽5–8、普通CAS消费、20个configured tick、3013范围与3012 direct HP统一死亡链、010/060世界表现及有限CPU库存策略；FUNC22/23已从真实技能来源重算射击修饰，Func22查询忽略静态遮挡并取half-width25最近非自己alive单目标，Func23 X200按总范围200%政策将1000对应2000。业务按客户端通信补全，原直接字段与推导政策分列`client-communication-business-rules.md`；零价/GGet0不开放免费取得，FUNC22/23原server分派、原始X单位和玩家grant仍开放。四项新增链路尚无实际对局、双端绘声或重启验收。M1-08至M1-13、M4和附录SKILL/ITEM仍有开放项。21战车与10宠物定义不能替代所有拥有、成长、装备、改装、维修、技能和场景动作业务。

65个原布局已有逐页任务，完整逐控件映射和父页业务尚未全部验收。交易主页面的有限双端与重启证据见`output/trade-root-review.json`；当前详情字段实现范围见`trade-detail-fields-implementation.md`，不借用旧主页面证据关闭新详情。Home与商城拥有页按确认定义ID显示完整21战车/10宠物原说明，商城拥有Pet生命值和预览沿确认记录，详`home-role-original-descriptions.md`与`shop-owned-role-original-content.md`；新展示范围尚无实际页面验收。动态文字沿用户附件字体，战斗伤害/治疗/暴击数字沿原图片。

独立发行、本机nginx反代和SQLite备份恢复已有各自限定证据：`standalone-release-accepted.json`、`release-proxy-accepted.json`、`account-backup-restore-accepted.json`。全资源干净环境重建、真实独立设备访问、全业务重启恢复和浏览器本地设置范围尚未全部完成，M8-01至M8-03保持原状态。

M7要求的1920/3840完整自然对局性能、最大人数服务节拍、长时清理、掉线重连及全部多人状态一致范围仍开放。当前执行仅允许代码走查，尚无这些缺项的新实测证据。M8-04与M8-05保持未完成。完整交付需要上述原权威规则和资源缺口解决，并满足正文要求的实际验收；静态走查不能代替这些条件。
