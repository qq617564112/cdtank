# 原重算getter9更新入口

原`4364c4`收到击毁通知后，在消息victim ID等于本机角色ID时，将本机getter9递增1，再经setter9写回role+24。getter9已被原`432951`用于Trigger14倍率；这是该已证初值0字段的具体更新caller，未接正式对局。

原`437848`将`4364c4`注册至回调对象，`4364d5–4364de`先将消息+14/+c/+10交给`429443`击毁通知。既有`ui-runtime.md`的原消息角色分析确认+10为被击毁者、+c为击毁者。本入口随后经`4269c4`取本机角色，真实ID getter与+10比较；匹配才调用virtual+14 getter9、x86 inc及virtual+24 setter9。实际`433250`的selector9分支`4332de`写role+24；尾部返回true，没有dirty/重算通知。

此入口无缺本机角色空指针门禁，依赖原运行上下文已有本机。增量具有int32回绕语义，不能以无界JS数值对应。该入口只观察本机被击毁，不将计数改名为全局等级/击杀/比分，也不推导当前权威服务器应在何时广播。

当前发布342技能只有10161使用Trigger14：Critical4、Func1/Tffff、Z3，其余运动/生命/弹量属性为0。原倍率方法在counter−3大于0时使用差值，否则1；既有1026技能倍率与完整重算原向量直接复用。本次不再执行native或模块。

## 正式边界

`RoleCombatState.recomputeCounter`目前保持已证初值0，参与独立life/ammo/movement/armor及完整属性重算。10161的宠物绑定producer与最终Critical作用消费者尚不足，本新caller未提供当前可正式取得并生效的独立业务。保留来源，不新增死亡计数policy、技能安装、重算触发或真实对局。

证据为`recovery/output/role-recompute-counter-update.disasm.txt`，已有`ui-runtime.md`击毁对象语义和`combat-field-inventory.md`getter9/倍率/初值合同。停止该入口进一步native及绑定调查；后续仅在明确合法技能来源与Critical消费业务时协调主线接线。
