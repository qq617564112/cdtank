# Pet2 10231–10235 受击移动 Web政策

大麦耍赖按所选宠物已学等级解析 10231–10235，ItemMove 分别为 1–5，持续时间统一取原 Func1.T=5 秒。大麦 JSON 配置 hit → attributes → self，生产入口由 PlayerState.petBattle 处理；完整规则见 [宠物战斗生命周期](pet-battle-lifecycle.md)。

实际敌对非本人伤害导致生命减少且受害者仍存活时安装增益。医疗、无敌、抵消、闪避、零伤害和同队伤害不触发，致死不安装。普通弹药、持续伤害和地面直接生命伤害共用受伤结果入口。

效果独立于原十六技能槽，经 runtimeSkillIds 进入统一移动重算；同级刷新至当前服务器时间加 5 秒，不叠加 ItemMove，期限到达时在本 tick 的伤害和运动前撤回。死亡、Leave、结束和再战统一清理，不写账户等级或库存。

原 Trigger5/Func1 服务端执行器与 Effect110/SE42 派发未恢复，当前为项目采用的战斗规则。

## 验证范围

旧首级有限证据 pet-hit-speed-engineering.json 与 pet-hit-speed-network-root-review.json 记录受击运动约 130→140→130、327 共同快照和同库重启。其旧临时字段与十六槽安装规则不代表当前生命周期实现。全等级及 JSON 路由本轮仅静态走查，未运行测试、浏览器、构建、类型检查或发行。
