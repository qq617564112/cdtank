# 账户装备请求与取证所有权

E-04本片沿真实AccountStore装备资格/槽数计算→装入或卸下门槛→profile局部写入→原子持久保存→房内部件来源更新整理职责。装备门槛不是双端执行规则：浏览器消费PtlEquipment联机结果，没有执行这些算法；内部RoleEquipmentItem/Request/Context随生产规则归服务端，PtlEquipment保持不变。

| 所有者 | 模块 | 实际职责 |
|---|---|---|
| server/accounts/equipment | request.ts | 原42762e装入请求门槛/固定部件与当前同类冲突/槽数，发送不修改装备 |
| server/accounts/equipment | unload.ts | 原4284ae状态2及当前实例匹配门槛，外观/标记/部件分支 |
| server/accounts/equipment | slot-count.ts | 原421cbe拥有容量减固定部件、加六个技能rank贡献 |
| recovery/evidence/roles | role-equipment-error.ts | 原4236ac错误通知，仅CTS使用，不写装备/profile |
| shared/protocols | PtlEquipment | 实际跨端请求/响应，本片不改字段或schema |

AccountStore直接调用新生产模块，仍用accounts/profile进行部件与外观读写及原子保存。普通部件UNEQUIP现有服务端业务按slot清除；原unload门槛在现有DECORATION/MARK卸下链实际执行。本片保持已有行为，不以迁移声称所有原装入/卸下服务端规则已恢复。四个函数体保持原样，旧shared四文件删除，无转发壳或副本。

四组原slot-count/request/error/unload native与CTS归evidence/roles。ROOT按新目录parents[3]解析，原oracle输出路径不变；CTS导入唯一生产规则或同目录错误取证。test:combat:equipment入口顺序不改：槽数→装入→错误→卸下，再执行其他独立选车/宠物/外观证据。生产不需要运行原二进制或错误取证算法。

## 验收条件与证据

原native/CTS检查原槽数、unsigned/有符号门槛、已有部件冲突/重复装备、卸下实例匹配和错误回调，以及profile与装备不受请求副作用影响。实际account-equipment与account-battle-equipment-sources检查持久保存/拒绝无写入/移动替换、profile20字节与标记、账户隔离/重启及拥有来源的准备/冻结/再战/清理。证据为engineering-equipment-boundary-evidence.log及engineering-equipment-boundary-rules.log。

集成检查：全仓类型/正式依赖，PtlEquipment及生成serviceProto SHA不变，两端独立构建和发行JS/map排除error，实际AccountStore引用新三模块；编译账户装备联机及重启保存/五模式CPU各两局；正常原装备页面键鼠操作/拒绝隔离/刷新重启及1080p4K；双网页账户AI普通输入自然两局/Effect11与GA15/拥有迷彩/资源声音归零/重启库存快捷槽和控制恢复。原8项native/CTS（384槽数、1080装入、80错误/16数组写入、1408卸下）、两项实际账户/source CTS及类型/218运行边界通过。PtlEquipment与serviceProto SHA一致，298发行JS/map排除error且AccountStore引用三真实新模块，编译账户重启/五模式各两局及原装备页面键鼠/隔离拒绝/1080p4K/刷新重启通过（engineering-equipment-boundary-{evidence,rules,types,boundaries,protocol,artifacts,server-build,compiled,equipment-browser}.log）。Web独立构建通过（engineering-equipment-boundary-web-build.log）；双网页AI自然两局74833/100269ms、原Effect11/GA15/拥有迷彩、双方退出instances/voices归零及服务重启库存快捷槽/控制恢复通过（engineering-equipment-boundary-two-rounds.log、engineering-equipment-boundary-browser.log及独立engineering-equipment-boundary-browser.json）。全部本片执行检查退出0；临时游戏服务/Vite/Chromium已关闭。

此片仅证明职责迁移及上述业务回归，整体E-04拥有来源/战斗规则与完整原玩法/资产/高清联机性能继续按tasklist恢复。
