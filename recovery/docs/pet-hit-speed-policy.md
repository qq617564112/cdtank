# Pet2 10231 受击移动 Web政策

M4-10/FUNC-01/Trigger5。原10231“大麦耍赖”说明被击中后5秒移动速度+10，Trigger5/Target1/Func1 T5、ItemMove1。普通玩家沿最终10211保存库选择既有peer Pet2 instance3，普通LEARN槽2首级费用10；预服务Point10明示为非earned，不改资金或拥有记录。旧10211/10221学习保持。

采用受伤后临时安装原技能的Web规则：所选拥有Pet2槽2 base10231/rank1，attributesReady且alive/status2；接受敌对非self伤害、实际生命减少后仍生命大于0才触发。普通暴击与方向防御仍沿一次原伤害链；医疗、无敌、抵消、零实际伤害与mode≤3同队不触发。普通弹药和地面直接生命伤害均经过同一受伤入口。最终致死不安装新移动状态。

第一次受伤在原current十六槽空位安装10231，重算现统一ItemMove消费者；不改拥有rank，不新增硬填速度。持续5服务器秒，到期优先于本tick运动；再次合格受伤将同一效果期限刷新至当前时刻+5秒，不重复加技能或累加速度。技能槽无空位时保持原伤害结果、无移动提升。到期只移除本状态安装的10231并重算；死亡、Leave、FINISHED、开新局清理。生命、弹匣、库存和账户保存不受临时移动状态影响。

root owns battle/pet-hit-speed.ts资格/计时/当前技能消费、PlayerState临时状态、World伤害入口与生命周期；Numeric owns原字段合同、统一移动数字及普通学习/自然受伤/普通移动/到期网络；UI ownsHome来源与原生控制、双网页位移/状态及退出。原Effect110/SE42仅来源字段，未确认原caller前不派新效果；current/selected变化不冒原Trigger5调度已恢复。

完成条件：普通未学受伤无提升→WAITING正式LEARN与Ready取消→自然受伤安装原10231→普通移动体现统一重算增量→5秒到期移除且移动回基线→正常双Leave/HomeClose、完整owned/学习receipt/库存与同库重启。工程覆盖资格、实际伤害门禁、一次安装/刷新、到期优先、槽满、死亡与各清理。正式consumer/World与生命周期已接，pet-hit-speed-engineering.json记录原source130→140与计时/生命/槽资格工程通过；3670唯一first93331实际exit0，普通未学/学后/到期三次移动实测129.996192/140.003409/130.001206，327共同完整快照与原生所有表、同库实际重启四QUERY通过；pet-hit-speed-network-root-review.json有限接受。3671网页实际验收待完成；原Trigger5/Func1/Effect110/SE42与完整父项保持开放。
