# 有资格暴击

M2-01/M4-09/M4-10 的普通敌对炮击读取当前攻击者 `attributesReady` 与 `combat.roleFloatFields[0x68]`。原属性来自已选角色凶猛值、技能与 DataScale5 限幅，原消息的暴击位控制 selector1/selector2。

Web 权威在友伤、无敌和攻击抵消判定之后，对存活且当前来源合格、概率大于零的攻击者产生一次 `[0,1)` 随机值。概率严格大于该值时，原始攻击乘二，再进入目标正面、侧面或背面防御。移动炮弹在实际命中时读取当前来源。医疗弹、周期伤害、自伤及友伤不产生暴击。最终整数 HP 移除继续作为生命吸收的基数。

同一命中的 `shotPlayerResult.critical` 由服务端判定并通过正式协议发送。网页只消费该标志，普通命中走 Damage 字体，暴击走 Critical 字体与原 `ui/regions/44/11.png` 附图组合；受击动作仍使用独立 hurtSelector。队列沿原符号、局部 Y 偏移、渐隐和清理生命周期。

原属性与消息依据复用 `shot-critical-consumer-preparation.json`、`role-shot-player-message-native.json`、`role-local-shot-hurt-native.json`、`role-shot-hit-flags-native.json`、`role-shot-trigger8-presentation-native.json`。字体与附图组合依据为 `actor-critical-combo-static.json`。

## 未恢复范围

原服务端暴击概率与倍率公式仍缺来源；本次概率解释、倍率二和判定时序是 Web 规则。原 CEGUI font+bc 动态度量及原 GPU 像素一致性未验证。Combo 与静止技能10821不属于本次闭环。有限命中样本不能证明统计分布或全部弹药表现。

## 验收入口

工程结果为 `shot-critical-engineering.json`，普通双端自然命中和原生账户审查为 `shot-critical-network-root-review.json`，双网页原生输入、Critical数字/附图真实渲染与退出为 `critical-hit-browser-root-review.json`，有限合审为 `shot-critical-root-review.json`。概率与倍率原公式缺口保持独立；每种弹药、附图的原 GPU 一致性及全部车型条件仍归父项。
