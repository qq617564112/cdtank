# 战斗非UI实现与来源边界

本页对照当前正式源码与原客户端、原表及已保存来源。地图目录、模型碰撞、普通复活、动作与特效均按当前消费者登记，正常战斗接线完成范围见[battle-production-closure.md](battle-production-closure.md)，详细总范围见[全内容交付范围](complete-content-audit-scope.md)。

## 本轮实现

| 范围 | 正式行为 | 直接来源与采用规则 |
| --- | --- | --- |
| 特殊弹药 | 连续弹丸按查询总射程扣炮口前移量推进，寿命与剩余行程一致，末段先扫掠命中再移除；Web按bullets快照消费采用本体／短尾迹。普通2001保持原定时即时查询。 | 原查询和定时链有保存证据；弹速、炮口和连续扫掠仍为Web采用。见[弹丸](battle-non-ui-shots.md)。 |
| 场景接触 | 普通运动消费真实Plant/Crush接触通知，首次隐藏释放碰撞；隐藏事件独立驱动原051消费者。 | 原type100与Plant/Crush集合、隐藏/051链有保存证据；enabled参与和地图业务范围是采用规则。见[场景](battle-non-ui-scene.md)。 |
| AI道具 | 正式CPU配置/等待页提供显式有限配给；真实库存、快捷槽和普通输入负责特殊弹药、陷阱和清理的自主选择，个人模式按真实owner判断陷阱敌我。 | 原表与已有权威执行器决定支持范围；选择时机属于Web决策。见[AI](battle-non-ui-cpu.md)、[剩余接线](battle-remaining-integration.md)。 |
| 垂直与坡面 | 共享垂直步负责NAV地面接触、下落和台阶拒绝，手动客户端与CPU/托管分别推进；视觉pitch/roll按显示朝向采样并在离地时归平。 | NAV高度与49×24×52构造尺寸有原来源；重力、限速、容差、落脚限高和视觉姿态按项目规则。见[垂直](battle-vertical-physics.md)、[坡面](battle-non-ui-ground-pose.md)。 |

小／中爆炸正常陷阱来源见[ground-blast-runtime.md](ground-blast-runtime.md)，雷达装配与特殊弹药取得见[radar-ammo-sources-runtime.md](radar-ammo-sources-runtime.md)，场景绘制与动画碰撞见[scene-lighting-render-runtime.md](scene-lighting-render-runtime.md)、[animated-scene-collision-runtime.md](animated-scene-collision-runtime.md)。

普通模式 Breach 生命/局内重生见[普通模式 Breach 生命与局内重生](battle-breakable-lifecycle.md)；Ctrl 绑定与道具/武器循环接线见[对局轮换与立即使用动作](battle-cycle-controls-runtime.md)。

有限库存仍沿既有权威资格和持久消费事务处理；场景接触不伪造射击、扣HP、积分或弹药。手动pose上报、用户0.7速度/转速标定、10秒普通复活和已删除的道具丢弃控件按现状态保留。

## 当前来源缺口

- 攻防按项目自己的最终伤害、侧背与暴击规则执行，详battle-damage-policy.md；原服务端完整公式不再阻塞实现。独立弹丸创建/速度/寿命/轨迹、原重力/滑动的来源仍按各专题登记；动态角色OBB统一49×24×52的生命周期来源已闭合，见role-final-footprint.md；垂直物理已按项目规则接线。
- 原AI producer、全部技能取得与触发尚未恢复。Func15的3007/3008已通过采用的有限陷阱接正常调用，13111/13112及Func22/23已通过采用商品接装备／选弹；这些原server授予来源仍未取得。4027已采用skill14合同补齐运行时定义与治疗绘声，原4027字段来源仍缺；七种道具取得已接Breach/结算奖励池。
- 十只宠物的五个开放技能槽已按全等级 JSON 配置接入 PlayerState 生命周期；条件与触发复制已接，首级/被动旧证据保留。原 Func17 writer、完整原范围与新增链路实测仍保持未完成。
- Breach 原资源已导出发布，30型号1144个放置均有自身原c9/C9，五种 fallback 的98个绑定已落盘；Type5蝙蝠/冰、m120纹理、BG07等缺原实体的条目已补作发布，原来源缺失仍登记。
- 全场景光照/fog、默认设备状态覆盖、模型排序和已绑定动画的逐帧碰撞已接生产；原环境完整来源／设备像素等价、动态角色OBB统一尺寸已有静态生命周期来源，普通对局仍按专题待验。Type10 index5采用后端已接，当前技能可达树没有Type10，原视觉对象仍缺来源。
- 扩展地图八图518株Plant JSON、0023 Castle十动作及obj05416材质已发布；五条General已绑定已有CVD并沿Web/动态碰撞消费，0003/0016独立water/waves及32帧已接普通加载与清理。详[extended-scene-resources-runtime.md](extended-scene-resources-runtime.md)；原像素/全设备等价与普通整图、双端、高清实测仍待做。
- 十二图1814个地形分片原材质metadata及三图五处采用纹理已发布；MV3动画NORMAL、CVD/破损/Type5模型priority和十二图独立环境已接。跨目录原搜索路径、ct-01-1精确原文件及fog/sectionLight producer仍缺来源；采用规则见[extended-scene-render-runtime.md](extended-scene-render-runtime.md)，实际场景/双端/高清未验。

饮料第二效果槽按存活自然到期采用规则单次通知，死亡／显式清除／换局／离房只清理；ww051短音已补作发布，新购40件饰品采用3天期限并沿既有维修时钟递减。真实复活skill30001保护在存活自然到期时单次通知第二槽Effect37，ww137已补作发布，死亡／显式clear／换局／离房只清理；原时机、原声音内容与新增实测保持开放，限制陷阱／群体闹钟成功自然恢复、燃烧4005自然完成时的第二槽及指挥10541获得／撤回两槽亦已接，新范围实测待做，详battle-remaining-integration.md U–X及AC–AF与remaining-effect-slot-integration.md。

## 验收范围

本轮完成一次集中静态走查。未编写测试用例，未运行测试、浏览器、构建、类型检查、lint或原生取证。资源解包检索、五种fallback及扩展地图Plant/Castle/material/water metadata的实际导出发布已执行。原有来源与实测证据只保留各自范围；新增链路尚无实际对局/双端/高清或持久验收，不关闭tasklist中要求这些条件的父项。

原25图角色toon纹理、默认灯方向与Silhouette效果选择已接生产，原128×2纹理及图级metadata已发布；普通Attach、INI门禁、ctl零候选和fog.enable0有静态原来源。普通几何toon空槽资格已有静态来源，完整设备像素和新增实测仍开放，见[scene-actor-toon-runtime.md](scene-actor-toon-runtime.md)。
