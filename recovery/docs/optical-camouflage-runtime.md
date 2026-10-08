# M4-10-I09 光学迷彩

原物件9「光学迷彩」关联skill9，BattleUseMax2；原技能9为Target1、TriggerType1、FuncType7、T10，三个Effect/Sound槽均为0。物件金钱价和软星币价均为0，GGet0，因此商城不增加物品9，也不发放免费初始库存。玩家路径从显式拥有的库存实例开始，CPU路径只使用房主配置的有限临时配给。

## 当前生产路径

普通Digit5至Digit8输入经43d4dc重建门禁进入`acceptBattleInput`和`optical-camouflage.ts`。成功路径先用既有消费确认保存拥有数量，再从确认实例扣一份、加入临时skill9，并在`PlayerSnapshot.opticalCamouflage={skillId:9,expiresAt}`暴露服务器期限。拒绝重复、无空技能槽、库存量变化和保存失败时，不改变库存或角色状态。技能时长必须来自原表正数T；当前资料为10秒。成功开火在弹匣、装填和库存CAS通过后主动解除隐身；真实延迟发射边界同样清除此时仍存在的效果。`restoreConcealmentAfterAcceptedFire`移除本模块临时skill9和状态、重算属性并发送`skillStopped`，随后快照恢复双方可见性；被拒绝的开火和普通选弹保留效果。隐身本身不限制移动。

到期在普通输入接收前和每个World步推进；死亡、复活、结算、首次开局、再战和正常离房只清理本模块建立的skill9与`opticalCamouflage`，不影响其它技能或输入sequence。死亡及FINISHED后不再发送带该状态的玩家snapshot。

观察规则由共享`isHiddenByOpticalCamouflage`统一：存活隐身目标对本机可见，团队模式1至3同队可见，团队模式敌对队伍及模式4至5的所有其它玩家均视为敌对观察者而隐藏。CPU敌人选择和威胁判断使用同一helper，目标变为隐藏时现有目标/路径重选；碰撞和手动弹丸命中不变，不提供碰撞免疫或伤害免疫。原Effect/Sound为0，不新增PlaySkillEffect或StopSkillEffect内容。

CPU可在槽5至8配置有限item9；`opticalCamouflageHotkey`只在存活status2、附近有可见敌人、HP不高于半血、技能槽有效且skill9未生效时返回普通输入槽。该输入仍由World普通权威门禁、消费事务和期限处理，不直接写world。

## 来源边界

普通请求只证明43d4dc的存活status2、实例查找和本局数量前置；3c9e不携目标或期限，3c92独立确认扣量。原43535e/43538e只给出存活与队伍目标判断，原Func7到actor的实际字段、原controller完整配置和原actor绘制可见入口未取得。当前隐身自用、确认顺序、期限、生命周期和观察规则是依据客户端通信及原表参数补全的服务端业务，不宣称为原Windows分支逐字段执行。详细推断链见`optical-camouflage-client-derived-server.md`，限定原证据见`optical-camouflage-source.md`。

## 未执行验收

当前交付为代码路径与文档走查。未执行普通玩家或CPU自然施放、到期/死亡/结算/再战真实对局、双网页高清显示、目标/路径实际行为、账户库存保存或服务重启恢复。上述运行验收与完整购买/配置链仍保持未完成；M6-06不因零价不售而免费发放，FUNC-07也不因本物件路径完成而关闭全部FuncType7。
