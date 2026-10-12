# 学习10311与新增部件槽权限

真实玩家闭环已通过：普通学习10311花费200点，Tank3部件容量2→3、目标槽2由拒绝变为可装备，10311与新部件13033来源双端一致，Ready取消、9共同完整快照、两Leave、原生保存和同库起停后完整QUERY一致。wrapper为 `recovery/output/pet-part-slot-learning-network-analysis.json`，独立root主审 `recovery/output/pet-part-slot-learning-network-root-review.json` 接受 `PASS_FINITE_ORDINARY_PET3_LEARN10311_NEW_PART_SLOT_READY_DUAL_STATE_NATIVE_RESTART_SCOPE`，完整父项保持开放。

Pet3毛姐的Skill0=10311、SkillLv0=1，PetSkill10311首级费用200原始Point；原Skill10311的PartSlot=1、Trigger0/Func1/T65535，说明“零件装备数+1。”。

原421cbe部件槽数和42762e装备门禁已正式接入 AccountStore.equipment/configureEquipment。slotCount由所选owned tank+6c扣除三个内置部件占用，再加入所选宠物六个base+rank−1技能的PartSlot贡献。Tank3原TankPartSlot=2，本片沿真实owned+6c与内置部件字段计算基线和目标槽，不用页面布局推定权限。

既有 `tests/account-equipment.cts` 第38行通过直接设置宠物base10311/rank1验证容量变化；该夹具不证明普通LEARN使装备从拒绝到允许。既有 `pet-learning-network-root-review.json` 实际覆盖Pet2槽4的10251中型熟练度，以及 `selected-pet-bound-network-accepted.json` 选中来源与移动。本片补普通学习到装备权限的缺失交付，不重复来源、维修、出售、射击或旧学习矩阵。

准备driver为 `tests/pet-part-slot-learning-network.cts`。合法饲料恢复尾checkpoint保存的双账户资金/拥有记录沿用，开服前只明确设置本人Point200夹具，非earned。普通BUY Pet3/14003、选用Tank3/Pet3，目标slot=学习前slotCount，首次EQUIP拒绝且确认保持；普通LEARN槽0成功后容量+1、Ready取消、10311成为被动来源；重新Ready后EQUIP目标槽成功并取消Ready，13033部件技能加入正式来源。最后普通双方Ready入场、完整samekey双快照/事件、两Leave、离房完整QUERY、原生profile/六rank/receipt/part保存和同库起停QUERY全文一致。

## 状态

专项driver类型检查runner90402 exit0。独立核原字段tank+6c=2、三个内置部件0、Pet3base44=10311、skill.PartSlot=1，强断言容量2→3、目标槽2；既有生产槽数计算器只作辅助对照。拒绝阶段完整Equipment/profile与Inventory不变。使用当前正式协议，生产文件无修改。

首raw `recovery/output/pet-part-slot-learning-network-2026-10-05T21-14-00-858Z.json`、runner85386 exit1，保存真实购买与槽2拒绝；学习receipt为0。原FAIL保持。定向未达尾沿该actualcheckpoint普通双认证、新房Join/Ready，没有BUY、Point、资金或owned补写，真实学习与新增槽位装备通过。尾raw为 `recovery/output/pet-part-slot-learning-network-2026-10-05T21-15-53-125Z.json`，runner23046 exit0，Pet实例6、部件实例7，六rank=[1,0,0,0,0,0]，槽位[0,0,7,0,0]。完整profile、六rank、receipt和part核原生数据库，正常离房完整QUERY与同一路径实际停止/重启后的QUERY全文相等。

finally已清理，端口3621为空，原生备份180224字节，private identity权限0600。来源学习初值、Point取得、账户授权及选中binding沿既有明示Web重建边界；不以本代表关闭完整装备/技能成长父项。

事件比较仅覆盖Leave前，两端核心事件数组为空。顺序退出后peer接到hostLeave/finish，最终事件数组不要求相等，不冒称完整退出事件同步。UI3622复用同tailcheckpoint的已学习实例、槽2部件作页面卸下/重新装备/Close，页面验收单独登记。

最终组合主审 `recovery/output/pet-part-slot-learning-root-review.json` 接受 `PASS_FINITE_PET3_ORDINARY_LEARN10311_SLOT_PERMISSION_SOURCE_READY_DUAL_STATE_NATIVE_RESTART_PAGE_CLOSE_SCOPE`。UI定向尾runner50523 exit0，正式Home Tank rdoEquip导航、槽2普通Delete、同实例7重新EQUIP、槽3禁用与Close，native完整profile/part已审。网络独立主审路径与原始FAIL保持，wrapper同时保留networkRootReview和组合mainReview，页面不冒称新增学习或交易来源。
