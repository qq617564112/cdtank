# 全内容交付范围

M8-04的原内容闭集来自现解码原表、布局和选定资源目录。目录、正式消费者、来源恢复与实际验收分别登记；资源存在不能替代对应业务和实测。

| 内容 | 当前来源与目录 | 交付任务 |
| --- | --- | --- |
| 4665个选定安装逻辑路径 | `output/catalog/inventory.json`；`output/asset-usage-index.json` | M3-01/02/12 |
| 65个原布局 | `output/catalog/layouts.json` | M5-01至M5-16、UI-01至UI-65 |
| 25图原放置 | `output/web-assets/scene-placements.json` | M3-05至M3-09 |
| 原13图26模式组合；当前25图111模式组合，另保留测试图1001 | 原m001–m005；当前目录见[可玩地图](../../docs/playable-maps.md) | M2-06至M2-13、附录MAP |
| 21战车、10宠物定义 | `output/verified/tables/tank.json`、`pet.json`；`combat-catalog.json` | M3-03/04、M6-01/03/04/06、附录TANK |
| 342技能、204道具 | 原skill.dat/item.dat；`combat-catalog.json` | M1、M2-01至M2-05、M4、M6、附录SKILL/ITEM |
| 12字体定义 | `output/web-assets/ui-fonts.json` | M3-10、M5-16、M7-01 |

## 当前正式实现

0001–0025已有正常房间入口。团队、擒王、混战和破坏各25图，占领仅开放真实Castle所在的11图。原26组合参数有直接来源；新增组合采用同模式首条原记录参数，人数范围是当前项目政策。原`cpu-all-maps/summary.json`只覆盖原26组合的50ms模拟时钟两局，不覆盖新增组合或实时双网页。

碰撞使用实际渲染模型三角面及对应NAV占用，动态物件隐藏后释放其占用贡献，详`render-model-collision.md`。手动运动由`LocalTankMotion`按当前NAV推进并上报pose，服务器接受后施加坦克碰撞；托管消费普通输入。出生/复活使用已恢复的分侧、近友远敌与49×52构造尺寸规则，见[出生规则](../../docs/spawn-rules.md)。当前速度和转速保持用户0.7标定，普通复活时间使用共享10秒常量。0008/0013四条`obj05023` Sequence已接普通base+screen、四帧、delay、精确resolved与ScenePreview生产链；screen实例克隆的既有原基色纹理在首次换帧前登记owner并在正常clear/失败清理释放。`scene-sequence05023.json` producer未执行、metadata未出版且实际页面/像素/双端phase/高清/GPU未验，本批最终范围已完成一次集中静态走查，详`scene-sequence-runtime.md`；Hook/WaterFall仍缺原loader/update/draw、节点赋值、挂点、材质或循环合同，Gate/Switch及部分General也未取得。

普通2001沿原03定时约0.4秒后查询，不创建独立飞行bullet；特殊弹药、技能修饰、临时状态和范围伤害按各自真实执行器接入。Func15已有3009定时炸弹、3013空袭、4004爆发弹及13151死亡自爆四条有限链，3007/3008的实际入口仍缺。Func22/23只从真实技能来源选择，不创建相同编号商品或免费授予。342技能和204道具的逐项范围以tasklist为准。

Type5模型后端已经由`EffectRuntime.createTree`接入`EffectModelRenderer`，保留原矩阵、CVD动画、材质与生命周期；模型后端实装不代表22种引用全有资源或全部技能实测。移动烟尘、开火/受击相机震动和基础相机已有消费者。Type10的index5缺后端，但当前342技能可达371节点中没有Type10，详`effect-screen-postprocess.md`。

结算奖励、实际装备奖励、退出处罚、账户成长、统计、九奖章、称号与佩戴已有正式事务/快照/页面消费者。原server producer缺失的部分按客户端请求、确认、原表和冻结结算数据采用业务规则，见`client-communication-business-rules.md`、`battle-equipment-exit-melee-rules.md`等专题。该实现状态不替代对应条目的实际对局、双端或重启验收。

## 未完成范围

- 原最终伤害、侧背防御与暴击公式、原弹丸出生/速度/寿命/轨迹和完整垂直/坡面/滑动处理仍缺直接来源。当前采用算法必须继续与原属性来源分列。
- 原AI决策、部分技能触发/取得/目标分派及全技能实测尚未完成。3006引用的4027在当前技能表缺记录；13111/13112和Func22/23的实际取得来源不由目录存在或零价授权。
- Breach共1144个放置，25个已发布型号覆盖1046个实例；05446/05463共17个实例待新共享库发布，05438/05440/05441共81个实例缺自身c9。详`scene-breach-catalog.md`。扩展图的专属地形、水面、Sequence/Hook/WaterFall与部分General行为尚未全部恢复；不能把未证明的Gate/Switch名称登记成真实可交互类。
- Type5的22种模型引用只有8种有可解析实物，bat/bianfu.cvd、bing_1..13.pol及youlincat的m120纹理仍缺；map0018的BG07 WAV缺失。缺失资源不使用替代模型、占位纹理或其它声音冒充原资源。
- 全场景光照/fog、设备状态继承与模型priority排序仍未完整恢复。原资源逐实例表现、原挂点/动作完整性和高清验收继续由M3/M4/M7追踪。
- 65布局的逐控件业务、21战车和10宠物的全部拥有/成长/改装/维修/技能仍有未完成条目。动态文字沿用户附件字体，战斗伤害/治疗/暴击数字沿原图片。
- 全资源干净环境重建、独立设备访问、全部业务重启恢复、1920/3840自然对局性能、最大人数服务节拍、长时清理和掉线重连仍按M7/M8开放。已有独立发行、反代和备份恢复证据只保留其限定范围。

当前执行只允许静态走查，不运行测试、构建、类型检查或浏览器。本轮战斗非UI实现和具体剩余项见`battle-non-ui-runtime.md`；新范围尚无实测，不据静态实现或走查关闭正文要求原来源/实测/高清的父项。地图0002沿接受基线，不追加局部补证。
