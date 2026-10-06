# 角色生命周期与普通射击装填

E-04本片整理create-player→角色状态初始化→准备/开局/道具与生命周期→actors定时步进与普通开火门槛→装填截止时间→弹丸瞄准。正式RoleCombatState/RoleRecordState/createRoleCombatState归server/battle/roles/combat-state；numeric默认值和原移动尺度归record-defaults；真实roleSkillMultiplier/isRoleFireReady/applyRoleFireReloadNotification归reload；实际createRoleFreeAim及其唯一请求/向量类型归free-aim。正式玩家、准备/开局、治疗/背包/弹药请求、属性发布、actors和projectiles导入真实owner。

原数值encoder/receiver只有两CTS使用，归evidence/roles/role-numeric-property。状态上的receiveNumericProperties没有正式调用，移除这一取证入口；CTS仍将原receiver应用于同一record.numericFields，接收通知后取同一state getter，部分失败写入/出站pending/快照保持不变。正式setter/getter/字段和通知行为保持。

原accumulate/compute reload及特殊弹确认通知归evidence/roles/reload；原respawn-notification/skill-observer/ammo-observer/max-hp/ammo-change-wire归evidence/roles同名。自由射击request门槛和codec归evidence/roles/role-free-fire，取证消费正式free-aim及其纯类型。旧shared十入口删除，无副本或转发，shared不反向引用server。保留现有数值原生/CTS对照命令，更新所有消费者导入；本片不发明特殊弹服务端权限或恢复未证实的装填参数。

## 验收条件与结果

原状态/装填/开火/接收/observer/特殊弹/free-fire/defaults/count共11专题命令通过（engineering-role-lifecycle-evidence.log）：323flag/28数组/8生命周期/868技能变更；63duration/24门槛/1026原累加；96普通射击通知float32截止时间与回调；16原numeric编码/92路由及部分失败写入、observer顺序与出站状态保持；2592弹药observer；512slot/table写入；400特殊弹确认/800codec/16UI分支/324真实信封；768自由射击门槛/24codec与15真实World弹丸方向；27原默认字段/尺度及128count getter/setter。

真实World普通flag11/float32 deadline、死亡复活与再战重置通过；装填回退仍使用已有prototype800ms，不能由边界验收认定原参数恢复。126原完整属性经World、21车开火/生命以及210持久来源准备冻结再战、32装备profile、204部件类别/74原被动向量通过（-world.log）。

全仓类型、217正式可达模块无取证依赖、独立服务构建及286JS/map四个唯一真实owner/原numeric和codec排除/实际actors与create-player/projectiles导入、shared无server逆依赖通过（-types/-boundaries/-server-build/-artifacts.log）。

独立Web构建与编译账户/迷彩真实联机重启保存、五模式各两局通过（-web-build/-compiled.log）。正常选择键鼠/来源控制/1080p4K/隔离拒绝/刷新重启通过（-roles-browser.log及独立-roles-browser.json）。双网页AI普通输入两局38026/102171ms自然结束，结算一致与再战门槛、原Effect11/GA15和拥有迷彩保持，双方退出instances/voices均为0，重启后库存/快捷槽及重新入场控制恢复通过（-two-rounds.log及独立-browser.json）。自然对局使用流程验收渲染设置，高清页面检查不证明高清全内容对局性能。

生命周期及numeric子项已验收勾选。E-04剩余仅验证helper、property-dirty及共同边界审查继续按实际消费者整理；原玩法/技能/界面资产/高清多人仍按M任务推进。
