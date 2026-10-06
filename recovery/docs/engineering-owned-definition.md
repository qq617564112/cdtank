# 账户拥有角色定义解析

E-04本片将实际server执行的resolveOwnedRoleTank/Pet从shared/combat移至server/accounts/owned/definition。账户battle-binding按已选拥有实例决定入场坦克；BattleRoleSources.tables解析坦克和宠物，供正式属性重算。两个原函数体保持，旧入口删除。只用shared/contracts的唯一base/equipment纯类型，没有shared对server的反向依赖。

原定义解析native/CTS移入evidence/roles；native ROOT为parents[3]，10宠物/21坦克原表oracle路径不变，test:combat:health更新入口。完整重算CTS及迷彩owned来源CTS直接消费唯一服务端解析，原实现无副本。真正跨端OwnedRoles及服务协议不改。

## 验收条件与结果

原对照覆盖1984组实例查找/记录/管理器/表存在性、uint32高位实例、查找次序和定义对象身份；112拥有迷彩来源及不完整来源门槛通过（engineering-owned-definition-evidence.log）。账户profile24原更新保存重启/隔离及实际CLI通过（-account-profile.log）；210持久坦克宠物来源绑定、准备/冻结/再战/重进及564完整重算、254缺来源与16原解析配对到持久账户/对局属性通过（-rules.log）。原对照证明解析行为，真实账户与World测试证明入场来源与生命周期。

全仓类型、218可达模块无取证依赖及独立服务构建通过（-types/-boundaries/-server-build.log）。294个发行JS/map检查唯一新server模块、旧shared模块及引用不存在，两处实际业务consumer导入新owner（-artifacts.log）。正式解析应该留在发行；原native/CTS不进入正式运行。

独立Web构建通过（-web-build.log）；编译服务真实账户/迷彩联机重启保存和五模式CPU各两局通过（-compiled.log）。正常选车/宠物键鼠、来源控制、1080p/4K、拒绝隔离及刷新重启通过（-roles-browser.log及独立-roles-browser.json）。双网页AI普通输入两局40111/95482ms自然结束，结算一致及再战门槛通过，原Effect11/GA15及拥有迷彩保持，双方退出instances/voices均为0，服务重启后的库存/快捷槽及重新入场控制状态恢复通过（-two-rounds.log及独立-browser.json）。两局采用流程验收渲染设置，1080p/4K页面验证不证明高清全内容对局性能。

本片检查的是账户实际解析所有权、原定义查找行为以及持久选择到正式对局的来源链；没有改动原函数体、表数据或跨端协议。tasklist本子项已勾选；剩余拥有来源/重算/战斗单端规则和仅验证helper按E-04逐真实消费者继续整理，完整技能、界面、原玩法及高清多人性能按M任务继续恢复。
