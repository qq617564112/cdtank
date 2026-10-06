# 正式对局生命状态同步

M2-01-H连接普通伤害、饲料与出生复活的实际生命字段，不恢复原伤害公式或缺失服务器施放因果。

原433250 selector15 setter迁到battle/roles/health，保持有符号32位原值赋写、notify12、下限0/上限MaxHP限幅及变化回调顺序；编码/接收仍在evidence。RoleCombatState.setHealth先把raw生命写numeric+54再通知，最终限幅结果回写；MaxHP写+58。battle/health是唯一正式组合入口，同步权威player.hp与attributes.record。

create-player构造、start首局/再战、preparation换车、life普通伤害和复活、healing账户消费确认后全部调用此入口。现有玩法与拥有来源政策提供上限，VIP/缺来源生命仍为明确重建回退。CAS和存储拒绝不调用生命写入，不先恢复或扣量。死亡/复活仍由既有权威生命周期判断，setter不伪造死亡消息。

60原setter向量经正式角色组合核对raw通知/夹取与最终字段；原health接收/observer/数组与72死亡后续回归通过。普通CPU自然伤害、拒绝、治疗、死亡复活、两局再战及重入共18680角色状态一致，含50死亡/51复活。相关证据：health-business-{setter,native,healing-world}.log、health-business-world.json；CPU首局9份自主施放/次局不回补见healing.log。

126原拥有属性/21车生命开火及玩法门禁见health-business-attributes.log；真实双连接普通施放/拒绝/同tick/消费保存和服务重启见network.log；共同生命改动集成后编译账户迷彩保存/重启与五模式各两局一次回归，见compiled.log。服务端新增生产入口独立构建、类型与231正式模块边界见build/types/boundaries.log，均同health-business前缀。

客户端生产未变；原首件树/挂点/声音以及死亡复活/自然释放相关回归见health-business-effects.log。healing-effect-life使用显式设备/动作夹具，原死亡时单次效果与声音策略仍属M4-09来源缺口。没有重复完整双网页两局或客户端构建，复用M1有效网页基线。

命令：test:combat:health-business；联机test:combat:healing:network；局部表现test:combat:healing:effect及test:combat:healing:effect-life。上述验收不替代M2-01完整攻防/伤害/VIP公式或原属性广播。
