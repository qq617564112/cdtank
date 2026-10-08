# 复活保护第二效果槽接线

真实复活的skill30001五秒免伤、首槽Effect100和第二槽Effect37已接。第二槽采用存活自然到期单次播放，ww137已补作发布并映射audio.json。

## 采用规则与生产链

World的真实advanceActors复活回调在respawnPlayer恢复status2／alive后调用applyRespawnProtection，建立一次五秒保护并通知Effect100首槽。首次出生不授保护，重复通知不刷新期限，item8独立状态保持。

simulateRoom逐tick调用advanceRespawnProtection。now达到expiresAt时先删除保护状态，再发送现respawnProtectionEnded；仅对player.alive且combat.status===2的角色附带skill30001／effectIndex1／duration0、真实numeric roleId及xBits/zBits0。重复advance因状态已删除不再通知，未到期不通知第二槽。

死亡／显式clear／finish／round／loading／Leave只执行现clearRespawnProtection，不发送第二槽。五秒免伤、首槽期限与权威推进顺序保持，第二槽没有新增计时器、停止消息或队列。

BattleSkillEffects.event转发实际playSkillEffect，SkillEffectNotifications按effects[1]选Effect37／sound0／tag0／method3，duration0沿现单次非retained消费者启动037树。

## 第二槽声音

037树的Type4节点2547为ww137、parameter0、stopPrevious=false、delay0。sound0仅表示独立技能槽声音为空；树声由EffectSound查audio.json中的ww137映射并播放。

ww137为独立补作的短下降电子光闪与柔和气流，资源、参数与publisher合同见[reconstructed-ww137-runtime.md](reconstructed-ww137-runtime.md)。export_tree_sounds沿现大小写无关的原同名声音优先规则发布，ended／stop／clear继续由现Type4消费者管理。

## 未完成范围

存活自然到期触发为项目采用，原第二槽触发时点和ww137原内容仍缺。普通对局／双端画面、实际声音输出及结束／清理、高清验收待做；当前交付仅资源发布与一次集中静态走查。未运行测试、浏览器、构建或类型检查，M4-09／M4-10完整父项保持未勾。
