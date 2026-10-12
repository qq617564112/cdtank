# Pet2 10211–10215 击毁回血 Web政策

大麦得意按所选宠物已学等级解析 10211–10215，1–5 级生命增量为 40／80／120／160／200。大麦 JSON 配置 kill → heal → self，生产入口由 PlayerState.petBattle 处理；完整规则见 [宠物战斗生命周期](pet-battle-lifecycle.md)。

仅在敌对最终死亡确认后，对仍 alive/status2、属性来源就绪且具有正生命的杀敌者恢复。本人、同队和未学技能不生效；最后一搏在最终死亡时才触发。死亡放置者不获得回血，待死生命不接受恢复。

恢复复用 setBattleHealth 的整数规则和最大生命夹取，事件只报告实际恢复量，满血不发治疗事件。修改当前战斗生命，不改账户技能、拥有记录或库存。原独立宠物效果与服务端 Trigger4/Func2 执行器仍未恢复。

## 验证范围

现存首级限定证据 pet-kill-heal-engineering.json、pet-kill-heal-network-root-review.json、pet-kill-heal-browser-root-review.json 和 pet-kill-heal-root-review.json 仅证明其记载的资格、夹取、延迟死亡及首级玩家流程。全等级和 JSON 生命周期本轮仅静态走查，未运行测试、浏览器、构建、类型检查或发行。
