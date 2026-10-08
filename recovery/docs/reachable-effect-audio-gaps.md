# 正常战斗特效树声音资源

正常战斗入口的五组共9个树声音已发布独立补作WAV，并在audio.json中按原reference映射。Type4树节点沿现EffectSoundNodeState与EffectSound播放、查询完成、stop及clear；节点次数、延迟和原独立技能／场景声音保持。

| 正常入口 | 效果树／节点 | 已发布补作声音 |
| --- | --- | --- |
| BUY17035/17036、装备后正式snapshot与被动队列13505/13506 | 035：2672/2673；036：2678/2679 | ww102、ww101 |
| 普通2014命中→4012首槽 | 023：2727/2728/2729 | ww078、ww079、ww077 |
| 普通2015命中→4013首槽 | 024：2735/2736/2737及2837/2838/2839 | ww078、ww079、ww077、ww053 |
| 猛虎王105正常死亡→09动作→ELK | 006：2516 | ww154 |
| 普通Castle首次低血／死亡→SceneCastleState命令 | 041：2446 | ww098 |
| 真实复活五秒保护存活自然到期→30001第二槽 | 037：2547 | ww137 |

资源与参数见[reconstructed-tree-audio-runtime.md](reconstructed-tree-audio-runtime.md)。035/036的ww101延迟0、ww102延迟1.5秒；024三个ww053节点延迟0、0.6000000238418579、1.2000000476837158秒，其余表内节点延迟0。各节点parameter为0、stopPrevious为false，时序和生命周期继续由当前树消费者负责。

## 生产链路与现有证据

服务端queuedPartSkillIds从确认部件／外观输出13505/13506资格，BattlePlayers把快照交给队列通知并启动035/036树。queued-part13505-actual.json与queued-part13506-actual.json已有普通购买／装备、双端原树绘制、原ww101/ww102请求及离房清理证据。

TankShotPlayerResult.showPlayerResult按2014/2015的victimShotResult消费TriggerType8技能4012/4013，创建023/024树并独立播放SE18/SE19。combat-shot-player-result-2014-actual.json与2015-actual.json已有正常有限购买／命中、双端原树及首槽声音、树请求与清理证据。

105死亡的09动作消息由EffectRuntime.message依原ELK启动006，GA12保持独立。既有普通双端死亡范围见[combat-death-09.md](combat-death-09.md)。SceneCastleState.damage在首次低血向root发041、首次死亡向五spout发041，SceneCastlePresentation经EffectRuntime.spawnCastleEffect消费；2446为实际child，独立GA48／SE03／SE07保持，普通304/305有限证据见[scene-castle02-presentation.md](scene-castle02-presentation.md)。

复活保护第二槽Effect37及树声ww137亦已接入，采用存活自然到期单次通知，详[respawn-protection-second-slot-gap.md](respawn-protection-second-slot-gap.md)与[reconstructed-ww137-runtime.md](reconstructed-ww137-runtime.md)。

## 未完成范围

这9个原声音内容仍缺；补作明确标记resolution/provenance为reconstructed。既有实测记录的缺文件输入与结果保持，不扩大为新增补作声音的实际输出证明。音色、叠加听感、实际双端完成／清理和高清性能待实测，完整M4-09/M4-10/M3-08父项保持未勾。当前交付仅资源发布与静态走查，未运行测试、浏览器、构建或类型检查。
