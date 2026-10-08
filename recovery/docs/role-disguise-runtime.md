# FUNC-08 南瓜与木桶伪装运行路径

原物件10/11分别关联skill10/11，BattleUseMax5；技能Target1、TriggerType1、Range0、FuncType8、T10，X1/2，首槽Effect3/GA16。原4173 `UMsgChangeStyle` 的style1选择obj05428南瓜、style2选择obj05422木桶，隐藏战车actor并按角色创建时XYZ创建替身；4174按roleId恢复战车并删除同角色替身记录。接收者要求角色与actor存在；原消费者没有本机、同队或敌对显示差异。

普通Digit5至Digit8输入经43d4dc重建门禁进入`acceptBattleInput`和`role-disguise.ts`。成功路径先执行既有CAS拥有量确认，再从确认实例各扣一份拥有量与本局量，加入本次临时skill10或skill11，并保存服务器`roleDisguise={skillId,style,startedAt,expiresAt,x,y,z}`。`x/y/z`固定为施放时权威位置；`startedAt/expiresAt`由服务器milliseconds和原表T10生成。拒绝重复、另一style、skill9隐身、已有9/10/11技能、技能栏缺失或满、库存量变化和保存失败时，不改变库存、技能或伪装状态；零价/GGet0不开放正式商城免费取得。

成功发送普通`itemUsed`，其中`skillId`为10/11，首个`playSkillEffect`复用原首槽Effect3/GA16，`effectIndex=0`、`duration=0`、caster roleId来自`P${roleId}`。随后发送独立`roleStyleChanged={roleId,style}`，公共事件XYZ来自权威施放位置。恢复发送独立`roleStyleRestored={roleId}`，不添加额外绘声或`StopSkillEffect`。

`PlayerSnapshot.roleDisguise`复制权威状态，供新进入或晚加载显示使用；没有状态时省略。到期在普通输入接收前和每个World步推进，死亡、复活、终局、首次开局、再战和正常离房只清理本模块安装的skill/state，不改变其它技能或输入sequence。死亡、结束和离房为实际恢复边界发送`roleStyleRestored`；首次开局、再战和迟加入依赖状态缺失。

伪装期间禁止车体移动与转向，炮塔仍可瞄准。`isBattleMovementAllowed`在已有角色许可之外检查真实`roleDisguise`，同时用于服务器运动推进和快照`canMove/canTurn`；手动客户端pose在伪装时只更新瞄准，不安装车体位置和方向。客户端进入或离开伪装时以权威位置同步预测，期间按快照许可停止移动。该门禁不修改陷阱的移动/转向贡献计数，到期或主动解除后仍按原许可判定。

普通开火只有在弹匣/装填/库存CAS门禁全部通过后才解除伪装及光学迷彩；`beforeFire`仅在`consumeConfirmedAmmo`返回真时调用`restoreConcealmentAfterAcceptedFire`。`advanceActors`在真实发射边界`fireProjectile`调用后立即执行`afterFire`，World清除此时仍存在的伪装/隐身临时技能，重算属性，伪装发送原`roleStyleRestored`，光学迷彩发送`skillStopped`；批末不再扫描`fire`，因此发射之后再次合法施放的新伪装不被撤销。该路径不改actor/pendingShot/query时序、弹药消费或声音特效。被拒绝的开火保留效果，普通选弹不解除，原flag12清理不等同模型恢复。碰撞、手动命中、伤害和CPU目标身份保持原规则。

光学迷彩互斥使用`roleDisguise`权威状态，而不是raw flag12；item10/11也拒绝skill9及有效光学状态。两种伪装style互不叠加。

CPU槽5至8可按房主有限配置使用item1至11及502，数量上限沿用原表；伪装策略只在存活status2、可见敌人距离300以内、HP不高于半血、当前`input.fire=false`、无有效伪装/隐身、技能栏无9/10/11且有空槽时返回普通伪装输入。伪装期间移动与转向同样受服务器门禁限制，原决策抑制主动开火，期限结束后恢复；不直接写状态或赠送库存。

## 未执行验收

当前交付为服务端代码路径与文档走查。未执行真实网络普通施放、浏览器与高清双端替身绘制/恢复、自然到期、合法与被拒开火、延迟真实发射窗口内再次伪装、死亡/结束/再战/离房、CPU两轮、账户库存保存或服务重启恢复。正常施放、持久恢复和完整FUNC-08/双style运行验收仍待实测。
