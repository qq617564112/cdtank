# 原角色生命增加浮字

下一玩家可见缺环是角色生命恢复时的原Benefit数字。现Damage浮字只消费真实hit的selector1，不能把playerHealed任意转为正值Damage文字或沿其向下速度。

| 层次 | 当前范围 |
| --- | --- |
| 原触发 | 42f43b HP observer比较selector15与role+31c缓存，严格增加且缓存非零才创建selector0文本；六原分支已执行 |
| 原记录 | selector0构造字段和Benefit font lookup已执行；共同46449f/465196、投影和本机Y偏移复用既有来源 |
| 资源 | Benefit.font已发布十个原数字PNG及800×600 AutoScaled元数据；没有plus glyph |
| 消费者 | 独立TankBenefitText与Benefit renderer已实现，专属CTS通过；共享record默认40、Benefit参数−40 |
| 正式接线 | 同角色snapshot HP缓存已接线，新HPobserver CTS通过首次/下降/死亡/复活/round/remove/selection/Leave静默及增加只入队一次 |
| 实战 | 普通受伤后Digit5治疗，双端同actor HP157→200/Benefit +43/原数字draw/自然到期/库存1→0/正常离房通过 |

## 原事件身份

42f43b以selector15读取当前HP，与role+31c先前值比较。只有currentHP>cachedHP且cachedHP!=0才继续；42f4e3计算currentHP−cachedHP，经42292f选择selector0，再经467209按正值+%d格式化。42f562最后将当前HP写回缓存，生命相等、下降、死亡和cachedHP0的复活均不创建恢复文本。42292f另要求actor存在且差值非零。

这不是任意治疗请求回执，也不从伤害负值取abs。不提供新的治疗数值、库存消耗或生命政策。42f45e/42f4b7与原低血技能服务的调用保持原分支，现有技能消费者证据复用，不在此处恢复额外规则。

tests/actor-benefit-text-source.py输出actor-benefit-text-source.json/log为PASS_ACTOR_BENEFIT_TEXT_HP_INCREASE_BRANCH_ONLY。六例当前/缓存HP含100→120、50→80、100→100、100→57、100→0和0→200，只有前两例提交+20、+30；每例最终缓存均更新。原observer、42292f和467209真实执行；角色HP/MaxHP getter、已有技能服务、CRT格式化和最终actorenqueue为明确记录供应。

## selector0与字体

原465e2b→selector0构造分支实际执行，原CEGUI字符串与FontManager为记录供应。字段为scale1、alpha1、elapsed0、fadeAfter0.5、expiresAt1、screenYRate−40，font为Benefit。共同更新46449f按record+44推进Y，因此恢复文本向上，不能沿Damage的+40或把delta反向。

发布的Benefit记录来自Data/ui/fonts/Benefit.font、smzj_sz_0.imageset，Static/AutoScaled true，NativeHorzRes800/NativeVertRes600。十个codepoint48–57对应ui/regions/9下的精确原图，全部路径存在；字体没有加号图片。逻辑文本+20仍保留plus，原未映射符号不制造替代glyph。

## 消费者边界提案

主线持有每个相同角色的HP观察缓存，按正式snapshot提交顺序更新；首次无缓存或缓存0不播，真实current>previous且previous!=0才一次入队。入队后仍使用原actor位置的当次整数投影、本机Y减100、每帧viewZ缩放和源f32 actor delta。角色移除/round/Leave沿所属队列清理，不让snapshot重复值重播。

FX提供独立TankBenefitText(renderer)与Benefit图字provider，show(screenX,screenY,increase,isLocal)、advance(actorDeltaSeconds,viewZ)、draw(viewport)、clear/dispose。record队列仅需让已有screenYRate40参数具名接受−40，字体renderer需精确接受Benefit原Static记录；不复制record算法、native/font采样或原Damage绘制。共享文件修改由主线协调窗口。

## 未完成范围

原字体GPU等价未验收。主线有限主审已接受双端early/fade绿色黑边43可辨及上移。角色HP属性网络接收、原低血效果与治疗服务器规则不由本片完成；不把source/native分支通过当作普通恢复已交付。


## 普通治疗验证驱动

tests/browser-tank-benefit-text.mjs使用3575/5605/9805，仅验证新的Benefit消费者。房前原tank1/pet1与已取得feed1、instance77、数量1为明确库存夹具，不主张购买流程。普通Home选择该行、独立数量字段及slot4；host原Arrow/Space使guest真实受伤，guest原Digit5治疗。驱动读BattlePlayers.reconcile调用前同actor的previousHp及收到的currentHP，再关联benefit调用、queue.show与真实glyph handle，恢复事件本身不替代HPobserver资格。

记录原Benefit数字ui/regions/9、逻辑正号且无plus glyph、入队整数位置、本机Y−100、向上Y速率−40、自然一秒到期、库存1→0和双正式Leave后资源0。首次或从0复活无播以专属集成测试和代码为证，不扩充为本次实战范围。完整callback canvas的可辨内容由主线审阅；prepare和语法检查不计实战通过。


## 发布与集成

主线HPobserver测试50212实际exit0，tank-benefit-hp-observer.log记录同actor缓存条件与生命周期重置。统一构建57715内Webtype0、Web build1m40/exit0，发布复制28490/exit0，index时间2026-10-05T13:56:58.262207386Z，工程记录benefit-part-owned-engineering.json。主线持有唯一3575普通治疗验证及finally清理；构建通过不代替实战或画面主审。


## 普通治疗实际范围

主线唯一runner22837实际exit0。browser-tank-benefit-text-2026-10-05T13-57-56-391Z.json为PASS_FINITE_ACTOR_BENEFIT_TEXT_NORMAL_LEAVE；一次离线helper生成tank-benefit-text-actual.json，PASS_FINITE_HP_OBSERVER_BENEFIT_TEXT_DUAL_LEAVE，无缺失门禁。

同P2自然受伤后HP157，经普通Digit5饲料恢复至200。两端reconcile调用前缓存均157、snapshot current200，benefit差值43各入队一次。host远端show(308,206)、guest本机show(320,384)后Y减100；逻辑+43保持，实际原regions9 code51/52绘制，未制造code43加号。host记录6次digit draw，guest14次；固定X、向上Y速率−40成立。host elapsed0.912400007加delta0.105300002、guest0.910199999加0.117600001跨一秒自然移除。

两端early/fade完整640×360canvas显示绿色黑边43及上移；guest early同时存在已接受的黄色Damage43，不能归作Benefit贡献。late文本淡化，完整图不证明原GPU或各glyph独立像素等价。六原图路径在actual.sides.captures。

原instance77库存1→0，双正式battle/summary Leave后worldnull，text mesh/material及regions8/9 texture均0。processPASS，server SIGTERM、Chrome exit0、临时目录移除；主线亲3575/5605/9805三空后释放GPU。本范围不主张饲料购买、复活实战、Scene销毁独立实测或父combat全部完成。主线mainReview及工程字段保留原位，未重复旧source/module/native/Damage验证。

主线终态tank-benefit-text-root-review.json：PASS_FINITE_ACTOR_SELECTOR0_BENEFIT_HP_OBSERVER_DUAL_LEAVE_SCOPE，actual.mainReview及engineering已关联，HPobserver module为tank-benefit-hp-observer.json。该子范围已交付，M4-09父范围继续保留未完成项。

## Pet2击杀恢复40复用范围

[主审](../output/pet-kill-heal-root-review.json)正式接受范围为`PASS_FINITE_ORDINARY_SELECT_PET2_LEARN10211_FINAL_HOSTILE_KILL_HEAL40_BENEFIT_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE`；[网页主审](../output/pet-kill-heal-browser-root-review.json)为`PASS_FINITE_LEARNED_PET2_10211_NATIVE_HOSTILE_KILL_HEAL40_BENEFIT_DUAL_STATE_NATIVE_RESTART_SUMMARY_HOME_CLOSE_SCOPE`。[工程出口](../output/pet-kill-heal-engineering.json)与[业务规则](pet-kill-heal-policy.md)已关联，该子范围已交付。

普通Select Pet2／Learn10211后自然敌对最终击杀恢复40，使用同一HPsnapshot Benefit消费者。双端各一次cached/current差值40入队，各8个原数字实际glyph frames，自然到期及Leave资源清零；716个共同完整snapshot与各网页own tick状态一致。[原始记录](../output/browser-pet-kill-heal-2026-10-06T02-23-56-449Z.json)对应runner26940实际exit0。

完整原生库仅正常settlement＋1／history＋2变化，profile、owned、inventory、hotkeys及receipt全文保持；真实同DB重启后的双账户查询相等。该实战范围不称全会话留存，不证明原Trigger4／Func2执行器、Effect11／GA15调用来源、原GPU像素或高清。10211没有新增effect sender，因此不从其表字段派发11／GA15，现Benefit正向反馈只沿实际HP增加。
