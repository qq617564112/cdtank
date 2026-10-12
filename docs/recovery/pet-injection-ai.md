# CPU普通输入解除燃烧

M4-10-I03-AI的规则及实际World两局验收通过。正式BotController在已有治疗选择之后、其他防护/弹药选择之前检查活跃burn与已配置item3库存，只发普通快捷槽输入；无敌方目标时也经过该道具选择出口。解除、有限消费及技能通知仍由已交付权威pet-injection模块处理。

`tests/pet-injection-ai.cts`的资格夹具覆盖死亡、非status2、无burn、未配置、错误物件、拥有量0、本局量0不发，以及满16长期技能槽不妨碍解除。controller调用证明治疗优先，无目标仍发普通slot5，decision不直接清burn或消费。该测试是规则夹具，不是实战。

`tests/pet-injection-ai-cpu.cts`从原map7源spawn、普通建房/CPU管理开始，开局前明确给三CPU各2007×15与item3×2，通过bindInventory七槽及普通Ready启动。此库存为明确初始夹具，不是正式网页CPU免费配给。运行期间无HP、位置、伤害、burn、事件或胜负写入；CPU沿正常控制器自主移动/选择/开火，自然2007命中产生burn后，下一控制器slot5/普通正序号输入进入正式itemUsed3消费并清除。

实际6次自主解除均在live pre-step burn存在、已有自然目标hit后发生，post-step burn清空；两局各30秒自然TIME_LIMIT，共112自然hit。所有CPU的注射剂拥有/本局量严格为2减去实际使用次数；第一局耗尽后再战没有补回，第二局无库存不再施放。最后普通Leave删除房间。结果并不依赖每CPU都必须耗尽的虚设条件，本记录中实际六份均已使用。

PlayerSnapshot没有burn字段，验收使用实际PlayerState的只读pre-step burn副本与post-step普通input/状态观察。首次测试因读取不存在的快照字段失败，原日志保留 `pet-injection-ai-cpu-first.log`；针对性修正观察入口后一次第二次执行通过，没有增加协议字段或降低条件。

命令：`npx tsx tests/pet-injection-ai.cts`、`npx tsx tests/pet-injection-ai-cpu.cts`。证据：`recovery/output/pet-injection-ai.json/.log`与`pet-injection-ai-cpu.json/.log`。本记录只证明World CPU内存库存范围，不证明持久本人托管账户或正式网页CPU库存供给；真实网页本人托管另由独立业务验收。

每次保存的pre-burn包含实际ownerId/startedAt/nextTick，input包含正常序号与slot5，post清空由运行时断言并记录postBurnCleared。生产World仅在实际2007 hitPlayer成功扣生命且目标存活时调用startAmmoBurn；测试同时断言先有该target自然hit。对应完整2007 fire/hit载荷未由本runner保留，不将它们描述为该JSON已包含的事件证据，未为此新增运行或采样。
