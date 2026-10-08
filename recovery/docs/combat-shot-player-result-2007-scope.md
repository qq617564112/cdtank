# M4-09 燃烧弹玩家结果消费者缺环

已恢复原2007炮口054/GA09普通双端实战；尚未恢复玩家命中受害者的skill4005/Effect14/SE03表现。现TankShotPlayerResult仅接受2001与2011，World正常2007 hit已附shotPlayerResult。来源424614 Trigger8分派与4886aa retention0非队列分支可复用，不能因此推定持续效果停止规则。

| 范围 | 当前状态 |
|---|---|
| 原物品/技能、节点与通用消息入口 | 已有catalog及424614/4886aa、488291/486b4a来源 |
| 原014具名资源 | 库已有，完整本对象资源消费者核验待做 |
| 2007持续受害者消费者 | 独立模块已实现；未import，未正式接线 |
| 持续火烟正式停止事务 | 权威ammoBurn快照及Battle接线已交付 |
| 普通双端受害者火烟与SE03 | 有限普通命中/死亡停止/复活不重播/Leave已验，主审接受 |

原014根2449 delay .6000000238、lifetime0，子2450 huo1/2451 huo2/2452 xiaoyanwu三个type6 lifetime0。零寿命在既有原树合同为持续节点，不能套2011自然2秒结束。源skill4005第一14/SE03，第二7/SE30，不据说明“9秒”或FuncT6猜两槽触发与动画到期。

现权威ammo-burn已有正常2007伤害后start、3/6/9秒跳伤、自然到期、注射剂解除、死亡与房间复位；这些是主线明确重建业务。客户端既有SkillEffectNotifications支持4005 retained三元组去重、30步期限及Stop全部匹配槽，正式BattleSkillEffects可消费Play/Stop。缺的是原ShotPlayer持续效果与该权威burn之间正式开始、到期/解除/死亡/再战事务合同。FX不修改server、不决定持续时间，也不把普通hit重播当持续开始。

## 权威快照消费者合同

主线指定独立`PlayerSnapshot.ammoBurn?:{itemId:2007,skillId:4005,startedAt:number,expiresAt:number}`，仅投影实际target.burn。主线给出的`expiresAt=startedAt+9000`属于明示重建业务时基，不是原014寿命或原server证据。

`apps/web/src/assets/tanks/ammo-burn-presentation.ts`导出`AmmoBurnPresentation(runtime,roleGetter)`，调用`reconcile(players,context,playing)`和`clear()`。context由主线提供房间与round身份；playing仅在正式PLAYING为true。角色资源就绪后应再次reconcile，snapshot也需调用。主线负责Battle实例、加载回调、快照与Leave接线。

消费者固定4005槽0：原014/tag0/oneShotfalse，SE03 selector-1。相同角色、绘制owner及startedAt只开始一次；expiresAt仅协议元数据，客户端不设置持续时间。权威presence消失、死亡、FINISHED、owner离开、round变化或clear停止原效果与声音。复用原retained三元组及Stop来源，未声明与原packet wire等同；持续首槽仍沿此presence消费者；第二槽7/SE30由World在存活自然完成时单次通知，详remaining-effect-slot-integration.md，其新绘声范围尚未实测。

`tests/ammo-burn-presentation.cts`及`output/ammo-burn-presentation.json/log`为PASS_MODULE_ONLY：late role、开始参数、去重、absence/death/finished/round/clear边界。`tests/ammo-burn-presentation-runtime.cts`及对应output JSON/log以真实EffectRuntime消费已发布014树2449–2452与具名纹理，验证持续粒子几何、活挂点、重复不重播、停止后释放tree/mesh；SE03为recording声音边界，不是实际可听证据。

## 未完成范围

正式协议已生成，Battle在snapshot和render补晚加载reconcile，Leave先clear。主线authority/codec/type证据直接复用。

`output/ammo-burn-presentation-death-scope.json`引用`browser-combat-shot-player-result-2007-2026-10-04T18-46-56-289Z.json`的限定普通命中段：相同双端2007命中、相同受害者burn epoch、原014真实owner挂点、SE03原loop selector-1及非零pre/postgain波形、自然死亡停止释放、双Leave四项0。014开始时受害者HP28，下一更新死亡；原.6s延迟前停止，rendered为空，无014可见画面。raw FAIL保留，摘要仅接受声音/死亡停止/清理范围。

预房原tank1/pet1及2007库存15、实例77、slot2为验收夹具，不是正式BUY取得。首次开发入口地图依赖错误记录在`ammo-burn-presentation-first-entry-gap.json`，专属runner使用临时Vite缓存。

`browser-combat-shot-player-result-2007-2026-10-04T18-49-38-188Z.json`为合法mode4/map7双普通Account、host单射手、guest观察、无CPU的补段。两端同一2007 hit与同一burn epoch，014三原节点2450/2451/2452实际绘制、live tag0，原火焰/烟雾在两natural整图清晰可辨；SE03循环有双端实际postgain输出0.506251/0.657437。每端一个epoch仅一个tree/voice，死亡停止释放，正常复活不重播，双Leave instances/meshes/voices/skillVoices全0。

两端保存逐正式snapshot tick/serverTime/HP/alive/presence。stopTick273、serverTime1791139813982，expiresAt1791139813944；停止时目标已HP0/alivefalse，所以接受自然burn死亡停止，不能单独证明存活到期。`tests/ammo-burn-presentation-actual.cts`输出`ammo-burn-presentation-actual.json/log`，PASS_LIMITED_PLAYER_SCOPE并记录每端完整HP/presence时间序列。natural-1-6.png与natural-2-4.png已实际亲看。此raw为PASS，先前两raw状态不修改。

主线已亲审原raw及双完整natural图，接受最后燃烧跳点死亡停止的有限范围，`ammo-burn-presentation-actual.json.mainReview`保存该结论。M4-09/M4-10由主线原位登记，父项保持未完成。

014专属完整原文件到发布资源核验未新增；本片只复用已有发布库和原retained来源。存活自然到期、注射解除、burn再战和第二槽7/SE30尚未验。M4-09/M4-10父项未闭；原伤害、9秒时基和flight仍按主线重建边界登记。
