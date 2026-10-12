# 准备和开局的完整属性计算与发布

E-04本片将真实准备/开局角色属性链收进server/battle/roles：attribute-state状态与发布、recompute编排、base初始化、技能选择/物品展开、skill累加、limits限值/转换、mastery精通、readiness缺源、data-scale目录限值加载及movement-setter。十个模块保留原实现，各有实际职责；旧shared入口删除。create-player/player-state/attributes/start直接消费attribute-state，catalog消费data-scale，projection与技能来源消费skills，现有preparation/start与World生命周期保持。

RoleRecomputeTankBase/PetBase唯一纯类型归shared/contracts/role-base，RoleSkillRecord唯一归shared/contracts/role-skills，web实际使用的CombatSkillDefinition仍继承该契约。内部Values/Input/Skills来源类型跟随server所有者；shared没有server反向依赖。真正跨端schema不涉及这些类型，协议文件保持。RoleCombatState/property-dirty/reload现有职责留待后续，独立boundGear与VIP原来源尚未恢复，本片不据整理宣称其完成。

七组原native/CTS归evidence/attributes：combat-role-skills、role-data-scale、role-recompute-base/limits/mastery/readiness及完整role-recompute。ROOT改parents[3]、原oracle输出不变；完整native的runpy base与data-scale AST引用接通，World属性native的runpy也接新路径。所有算法/类型/正式消费及其他CTS导入更新，无复制或转发壳。test:combat各专题命令使用新入口。

## 验收条件与结果

14条原native/CTS命令全部退出0（engineering-attribute-chain-evidence.log）：343被动谓词/1096技能选择、53data加载/23限值对/HP cap与reload、96base来源/342完整技能字段/410物品展开、758全字段限值与758精通、128缺源门槛、564完整计算及observer属性/通知/dirty、254缺源状态及16原pair→账户持久化→实际属性。

真实账户来源/装备profile/204物品及74原被动向量、210持久tank/pet准备/冻结/再战/重进通过（-sources.log）。玩家状态及World普通开火/道具/dirty通知通过（-state.log）。World126原完整属性和21车开火/开局生命检查使用更新后的native依赖，结果记录-world-attributes-recheck.log。

全仓类型、218正式可达模块无取证入口、服务端独立构建和298个JS/map发行十个唯一owner/旧shared模块排除/实际consumer及shared无server反向引用通过（-types/-boundaries/-server-build/-artifacts.log）。

独立Web构建和编译服务账户/迷彩真实联机重启保存、五模式CPU各两局通过（-web-build/-compiled.log）。正常选车宠物键鼠/来源控制/1080p4K/隔离拒绝/刷新重启通过（-roles-browser.log及独立-roles-browser.json）。双网页AI普通输入两局99478/77026ms自然结束，结算一致/再战门槛、原Effect11/GA15及迷彩保持，双方退出instances/voices均为0，服务重启后库存/快捷槽与重新入场控制恢复通过（-two-rounds.log及独立-browser.json）。自然两局采用流程验收渲染设置，高清页面检查不证明全内容高清对局性能。

本片已验收勾选，下一按角色生命周期→普通射击装填截止时间真实链区分正式状态/规则与原numeric/wire取证。E-04其余状态/数值/装填/开火和仅验证helper继续整理，完整技能玩法/界面资产/高清多人另按M任务验收。
