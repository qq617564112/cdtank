# 账户来源选择与战斗来源组装

E-04本片贯穿账户已选拥有记录→等待房间装备部件解析→完整属性重算→对局来源投影。正式来源选择resolveRoleRecomputeSource只有AccountStore执行，归accounts/owned/source-selection；等待房间的resolveBattlePartTableIds归battle/roles/part-definitions；属性和投影共用的readRoleSkillSources归battle/roles/skill-sources。三个函数体保持，shared旧入口删除，没有副本或转发壳。

来源选择保留stage2按profile已选实例查找、stage3/4直接来源及其余阶段无来源；装备实例与ItemTable ID仍分开，拥有数量/state2/类别及目录门槛保持。技能来源读取保留当前技能、独立boundGear、额外技能和装备/角色物品字段来源；生产boundGear仍未恢复，不把owned base误当独立绑定装备。本片不发明原服务端装备转移行为。

两个Owned记录type与RoleSkillSources现有契约按纯类型导入，真正共同catalog/item-hotkeys/Inventory协议保留shared；没有shared反向引用server。未迁剩余角色状态/重算算法簇。原来源选择native/CTS迁evidence/roles，ROOT改parents[3]，oracle不变。账户records及原owned base/equipment/receive CTS、新完整重算和record-defaults CTS均接通唯一实现；test:combat:health使用新取证入口。

## 验收条件与结果

原来源选择96组阶段/选择/拥有实例、8原profile选择读取设置和16配对账户记录保存/隔离/显式导入CLI通过（engineering-role-source-selection-agent.log）。204物品类别及74原被动选择向量经实际World部件定义通过，包含数量/state/缺定义/实例ID与表ID冲突/准备取消/冻结再战/隔离（engineering-role-source-assembly-parts.log）。

实际默认值/完整技能字段/真实数组槽与缺记录保持、96解析拥有来源到base初始化、342技能来源MaxHP/装填和完整字段/410物品展开、564完整重算/通知/dirty合同、254缺来源及16配对解析→账户持久化→对局getter→完整属性通过（-skills.log）。210持久来源到World准备/冻结/再战/重进通过（-sources.log）。原对照检查选择规则，业务测试检查装备实例被解析为正确被动技能并进入真实状态。

全仓类型、218正式可达模块无取证依赖、服务端独立构建及294JS/map的三个唯一owner/旧shared入口消失、AccountStore/preparation/attributes/projection实际导入通过（-types/-boundaries/-server-build/-artifacts.log）。

独立Web构建通过（-web-build.log）。编译服务账户/迷彩真实联机重启保存及五模式各两局通过（-compiled.log）。正常选车宠物键鼠/来源控制/1080p4K/隔离/拒绝/刷新重启通过（-roles-browser.log及独立-roles-browser.json）。双网页AI普通输入两局77107/89291ms自然结束，结算一致与再战门槛、原Effect11/GA15/迷彩保持，双方退出instances/voices均为0，服务重启后库存/快捷槽及重新入场控制恢复通过（-two-rounds.log及独立-browser.json）。自然两局采用流程验收渲染设置，1080p4K页面检查不证明全内容高清对局性能。

本子项已按验收勾选；E-04与完整复刻仍按剩余清单推进。下一业务边界为服务端正式战车/宠物表加载到拥有定义和重算来源：两个读取函数实际在config执行，纯定义契约仍供现有shared验证类型使用，需先分唯一type再迁正式加载，不一次搬整个重算簇。
