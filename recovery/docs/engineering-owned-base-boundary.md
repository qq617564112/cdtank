# 拥有基础记录契约与原读取取证

E-04本片完成owned基础/装备记录与原消息解码的职责边界：基础记录实际生产只使用内部Map类型；record/packet/batch/message读取和原MaxHP getter没有正式值消费者，全部只供原程序对照。Skill/recompute生产链直接读取记录字段，不能凭函数名把原getter算正式服务端逻辑。

唯一OwnedRoleBaseRecord归shared/contracts/owned-base.ts，保留ReadonlyMap<number, number>与name。原5函数归evidence/roles/role-owned-base.ts，函数体原样；原shared入口删除，无副本或转发。账户/owned接收及现有计算/定义规则消费纯类型，shared不反向引用server。内部Map类型目前仍有待迁计算消费者，后续按真正消费者再收拢，不将本片视为整体E-04完成。

原native与CTS迁evidence/roles，ROOT按新目录parents[3]解析，原oracle路径不变。Base本身无oracle输入，随后equipment读取base输出、pair runpy装备原程序、receive验证真实接收，原依赖顺序可追踪。test:combat:health更新新入口；base/equipment解码、pair/batch消息都由唯一evidence实现承担，真实账户来源与skill/recompute保持原调用链。

## 验收条件与结果

7项原命令通过：96基础读取/原MaxHP拷贝、5原batch清空/构造/真实树重复选择、5完整4078消息及unsigned尾字段、装备/3aab容量、3aa5配对和接收引用（engineering-owned-base-boundary-evidence.log）。

账户16paired记录保存/隔离/CLI、210持久来源绑定/准备/冻结/再战重进、96解析来源到完整base重算、342来源技能MaxHP/装填与342字段/410物品展开通过。错误调用不存在的tests/role-skill-sources.cts导致原rules组合末项退出1，日志保留；技能来源实际由recovery/evidence/attributes/role-recompute-base.cts覆盖，并补验存在的完整recovery/evidence/attributes/role-recompute.cts，结果记录engineering-owned-base-boundary-skills.log。不创建只为填补名称的镜像测试。

全仓类型与218正式可达模块边界通过，PtlOwnedRoles及serviceProto SHA不变。集成验收继续检查独立两端构建、发行JS/map排除基础读取/生命getter、编译账户/迷彩联机重启保存及五模式CPU各两局、原选择页面1080p4K及键鼠/拒绝隔离/刷新重启、双网页AI自然两局/Effect11与GA15/拥有迷彩/实例声音清理与重启库存快捷槽控制恢复。

集成验收已完成：server/web独立构建通过；294个发行JS/map排除五个原基础取证函数（engineering-owned-base-boundary-artifacts.log），编译账户/迷彩真实联机重启保存及五模式CPU各两局通过（-compiled.log）。正常选车/宠物页面键鼠、来源控制、1080p/4K、隔离、刷新/重启与拒绝通过（-roles-browser.log及独立-roles-browser.json）。双网页AI普通输入两局分别102024/68440ms自然结束，原Effect11/GA15及拥有迷彩保持，双方退出instances/voices均为0，服务重启后库存/快捷槽保留、重新入场控制恢复通过（-two-rounds.log及独立-browser.json）。两局采用流程验收渲染设置，高清页面验证不等于全内容高清对局性能通过。

验收各自检查原包体与oracle依赖、真实来源绑定/属性重算、运行依赖污染、发行取证泄漏、协议兼容、持久化及再战/释放生命周期。tasklist仅勾选本基础记录子项；E-04整体仍未完成。完整原认证、技能/玩法、全资产及高清全内容联机性能仍按tasklist对应任务恢复。
