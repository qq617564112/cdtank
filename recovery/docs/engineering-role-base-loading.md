# 正式角色表加载到对局属性

E-04本片整理正式config启动读表→拥有实例解析定义→对局完整属性。readRoleTankBase/readRolePetBase实际只在server/config执行，合并归server/config/role-base；原函数体与Number/int32转换、Math.fround装填保持。RoleTankBaseDefinition/RolePetBaseDefinition唯一契约归shared/contracts/role-base，现有重算及取证绑定类型消费者只消费type，shared不反向依赖server。旧两个shared混合入口删除，没有副本或转发。

原tank/pet base native/CTS归evidence/roles，ROOT按parents[3]，原表与输出oracle路径保持。config实际读原提取tank/pet表，CTS既比原loader结果又检查TANKS[].recomputeBase/PET_BASES的正式实载。test:combat:health的取证路径更新；完整owned-definition/table-binding/recompute oracle依赖仍可追踪。不迁剩余重算算法簇或改原表值。

## 验收条件与结果

21完整战车、10完整宠物原加载及正式config源字段映射、1984拥有实例到定义原查询全部通过（engineering-role-base-loading-evidence.log，6命令退出0）。原加载验证整数字段、四精通累加器与float32装填；实例解析覆盖10宠物/21车及缺来源/表/管理器、高位instance。

96解析记录到base重算、342技能MaxHP/装填及完整字段/410物品展开、564完整重算/通知/dirty、254缺来源和16原配对消息→账户持久化→对局完整属性、210持久来源准备/冻结/再战/重进通过（-rules.log各现有入口结果）。126原完整属性经实际World及21车普通默认弹开火/开局生命通过（-world-attributes.log）。

全仓类型、215正式可达模块无取证依赖、独立server构建、294发行JS/map唯一loader/config实际导入/旧shared函数不存在通过（-types/-boundaries/-server-build/-artifacts.log）。正式loader保留在服务端发行，纯类型契约不携带读表算法。

独立Web构建通过（-web-build.log）。编译服务账户/迷彩真实联机重启保存与五模式CPU各两局通过（-compiled.log）。正常选择坦克宠物键鼠/来源控制/1080p4K/隔离/拒绝/刷新重启通过（-roles-browser.log及独立-roles-browser.json）。双网页AI普通输入两局35684/70891ms自然结束，结算一致及再战门槛、原Effect11/GA15/迷彩保持；双方退出instances/voices均为0，服务重启后库存/快捷槽和重新入场控制恢复通过（-two-rounds.log及独立-browser.json）。自然两局采用流程验收渲染设置，高清页面验证不证明高清全内容对局性能。

本子项已验收勾选，E-04及完整原规则、界面、资产与高清多人目标仍按剩余清单推进。
