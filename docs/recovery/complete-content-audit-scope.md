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

正常战斗已登记生产接线与发布范围已完成，见[battle-production-closure.md](battle-production-closure.md)；该范围不关闭本页完整原版与实测父项。

## 当前正式实现

0001–0025已有正常房间入口。团队、擒王、混战和破坏各25图，占领仅开放真实Castle所在的11图。原26组合参数有直接来源；新增组合采用同模式首条原记录参数，人数范围是当前项目政策。原`cpu-all-maps/summary.json`只覆盖原26组合的50ms模拟时钟两局，不覆盖新增组合或实时双网页。

碰撞使用实际渲染模型三角面及对应NAV占用，动态物件隐藏后释放其占用贡献，详`render-model-collision.md`。手动运动由`LocalTankMotion`按当前NAV和共享垂直物理推进并上报pose，服务器接受后施加坦克碰撞且不重复下落；CPU/托管沿服务端入口推进垂直。地面接触、下落和台阶拒绝为项目采用规则，见`battle-vertical-physics.md`。出生/复活使用已恢复的分侧、近友远敌与49×52构造尺寸规则，见[出生规则](../../docs/spawn-rules.md)。当前速度和转速保持用户0.7标定，普通复活时间使用共享10秒常量。0008/0013四条`obj05023` Sequence已接普通base+screen、四帧、delay、精确resolved与ScenePreview生产链；screen实例克隆的既有原基色纹理在首次换帧前登记owner并在正常clear/失败清理释放。`scene-sequence05023.json` metadata已发布，实际页面/像素/双端phase/高清/GPU未验，本批最终范围已完成一次集中静态走查，详`scene-sequence-runtime.md`；Hook/WaterFall消费者和metadata已接，原完整loader合同与采用规则仍待验；五条General动画绑定和两图独立water/waves已接普通入口，八图518株植物、0023城堡十动作及05416材质metadata已实际发布，详extended-scene-resources-runtime.md；普通页面、碰撞对局、双端与高清待实测。

普通2001沿原03定时约0.4秒后查询，不创建独立飞行bullet；特殊弹药、技能修饰、临时状态和范围伤害按各自真实执行器接入。Func15已有3009定时炸弹、3013空袭、4004爆发弹及13151死亡自爆四条有限链，3007/3008已接采用的有限爆炸陷阱取得与触发。Func22/23已有正价有限弹药取得、配置与当前选弹来源，原服务端授予规则仍缺来源。342技能和204道具的逐项范围以tasklist为准。

Type5模型后端已经由`EffectRuntime.createTree`接入`EffectModelRenderer`，保留原矩阵、CVD动画、材质与生命周期；22种引用均已有发布资源，缺原文件的模型／纹理采用补作，不代表全部技能已实测。移动烟尘、开火/受击相机震动和基础相机已有消费者。Type10的index5已接采用的scene后端，但当前原技能可达树中没有Type10，原index5视觉对象仍未恢复，详`effect-screen-postprocess.md`。

结算奖励、实际装备奖励、退出处罚、账户成长、统计、九奖章、称号与佩戴已有正式事务/快照/页面消费者。原server producer缺失的部分按客户端请求、确认、原表和冻结结算数据采用业务规则，见`client-communication-business-rules.md`、`battle-equipment-exit-melee-rules.md`等专题。该实现状态不替代对应条目的实际对局、双端或重启验收。

M6-06-HAT40的40件原category5饰品`10001..10040`已追加到现`partShopItems`，复用普通`Shop QUERY/BUY`、钱包、receipt、inventory与owned实例，并沿原Home `DECORATION`装配路径和既有装备入口；确认装配已由PlayerSnapshot投影，BattlePlayers／BattleTankDecoration消费模型、贴图与原挂点。`classifyItemId===5`当前采用范围为`10001..11000`，本批只取`10001..10040`，不纳入`11001..12000`。原`Durable=3`、`GGet=0或2`只作literal展示；74件category8..12已售部件不重复，`2010`保持原`0/0`与mode5掉落、不免费售，`2016`普通正价取得链已接，其原025 stop caller仍缺来源。详`decoration-purchase-client-business-design.md`。

攻防采用项目自己的最终伤害、侧背修正与暴击规则，原属性合成继续按已恢复来源；原服务端完整公式不再作为实现前置，详`battle-damage-policy.md`。

## 未完成范围

- 原弹丸出生/速度/寿命/轨迹，以及原重力与坡面滑动仍缺完整来源；动态角色OBB在已覆盖的创建、运动、预测、状态与位置重置链中保持统一49×24×52，见role-final-footprint.md；垂直运动已采用项目规则接入。当前采用算法继续与原属性来源分列。
- 特殊弹连续轨迹已有Web本体／短尾迹消费者；四种饮料存活自然到期单次触发第二槽Effect10/SE02；ww051已补作发布。落樱／霜雪、2014/2015弹药、105死亡、Castle041与复活保护037共9个树声已补作发布并接入audio.json，详reconstructed-tree-audio-runtime.md。复活保护第二槽Effect37、限制陷阱／群体闹钟第二槽及燃烧4005第二槽已按存活自然恢复／完成的采用时点通知；宠物指挥10541按真实有效来源获得／最后撤回单次通知两槽，详remaining-effect-slot-integration.md。原飞行外观／第二槽触发／原音频内容与新增实测仍待完成，详battle-remaining-integration.md U–W及Y–AC。
- 原AI决策、部分技能触发/取得/目标分派及全技能实测尚未完成。原4027表缺记录，项目已采用skill14合同补齐定义与治疗绘声；13111/13112和Func22/23通过正价PART/弹药取得，七种零价道具已接Breach/结算奖励池，原授予来源与采用规则分列。
- Breach共30型号1144个放置：25个既有型号库覆盖1046实例，五种已发布fallback覆盖98实例，原c9/C9实物与破损绑定齐全。详`scene-breach-catalog.md`。扩展图Plant/Castle发布输入、五条General动画、两图独立水面及Sequence/Hook/WaterFall消费者已接；专属地形材质、完整原行为与各场景实际表现尚未全部验收；不能把未证明的Gate/Switch名称登记成真实可交互类。
- Type5蝙蝠/冰、m120纹理和BG07已按授权补作发布；原资源缺失与补作来源边界继续登记，不能将补作写成原资源恢复。
- 全场景光照/fog、设备状态继承与模型priority排序已接生产，原完整环境/设备来源与像素等价仍未恢复。原资源逐实例表现、原挂点/动作完整性和高清验收继续由M3/M4/M7追踪。
- 65布局的逐控件业务、21战车和10宠物的全部拥有/成长/改装/维修/技能仍有未完成条目。动态文字沿用户附件字体，战斗伤害/治疗/暴击数字沿原图片。
- M6-06-HAT40的商城、装配和战斗饰品模型已接；维修成功后的期限锚定、墙钟递减、查询和交易转移已接，新购精确40件饰品单次BUY一个实例采用3天期限，并在原购买事务锚定，重放不重新起算；原初值／起算规则待恢复。原server出售授权、逐币种真实BUY、持久重启、真实页面、双端表现和HD实测仍未完成；详battle-remaining-integration.md X，M6-06父项保持开放。
- 全资源干净环境重建、独立设备访问、全部业务重启恢复、1920/3840自然对局性能、最大人数服务节拍、长时清理和掉线重连仍按M7/M8开放。已有独立发行、反代和备份恢复证据只保留其限定范围。

当前执行只允许静态走查，不运行测试、构建、类型检查或浏览器。本轮战斗非UI实现和具体剩余项见`battle-non-ui-runtime.md`；新范围尚无实测，不据静态实现或走查关闭正文要求原来源/实测/高清的父项。地图0002沿接受基线，不追加局部补证。

十二图1814个原地形分片metadata和三图五处采用纹理已发布，MV3动画法线光照、CVD/破损/Type5模型priority与十二图独立环境参数已接，详extended-scene-render-runtime.md及battle-remaining-integration.md P–T。原纹理搜索路径、ct-01-1精确原文件及fog/sectionLight producer继续登记来源边界；实际场景、动画光照、透明交叠、双端与高清未实测，M3-06-EXT-RENDER完整父项保持开放。

原0001–0025的角色toon已按原Silhouette门禁接普通TankView组件，原默认灯[0,200,0]、128×2纹理与角色中心方向进入正式消费者；25份原ctl均零候选、同名INI fog.enable均0。来源与生产范围详scene-actor-toon-runtime.md，普通几何toon空槽资格已有随包模块静态来源，原D3D像素及新增实测继续开放。
