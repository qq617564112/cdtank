# 拥有战车装备记录契约与原解码取证

E-04本片拆开内部拥有装备记录类型与原程序解码。生产账户保存和共享纹理/重算/技能/定义规则只使用Map记录类型，不执行原record/packet/batch读取。真正PtlOwnedRoles联机传数组字段，本片没有改跨端协议或schema。

唯一OwnedRoleEquipmentRecord定义归apps/shared/contracts/owned-equipment.ts，字段仍为ReadonlyMap<number, number>与name；shared真正双端role-owned-textures及待迁服务端计算规则消费纯契约，不形成shared→server反向依赖。未来仅服务端消费者迁完后再按实际类型消费者收拢。本片不以临时纯契约归属代表整体E-04完成。

原字段表与readOwnedRoleEquipmentRecord、readOwnedRoleEquipmentPacket、receiveOwnedRoleEquipmentBatch归recovery/evidence/roles/role-owned-equipment.ts，函数体原样；原shared入口删除，无转发壳或副本。AccountStore、server/owned接收与shared各类型消费者引用新契约，配对取证和其他CTS引用唯一evidence decoder。

原native及CTS归evidence/roles，ROOT按新目录parents[3]解析，读取已有base原oracle与输出equipment原oracle路径不变。Pair native的runpy改到新equipment-native.py，继续实际执行底层原程序而不是复制数据。test:combat:health和相关专题命令保持原顺序，配对/纹理/来源测试消费者已同步。

## 验收条件

- 原字段位宽/名称/顺序、96记录、批次首重复保留/索引/位流，以及3aab附加数组容量和3aa5配对/接收引用行为。
- 真实账户记录保存重启/隔离/CLI、装备profile事务、210战车宠物来源绑定到World、原重算base与迷彩fields，确认纯类型拆分没有改变行为。
- 全仓类型/正式依赖门禁，PtlOwnedRoles和serviceProto SHA不变；两端独立构建及发行JS/map排除原字段表/codec。
- 编译账户/迷彩真实联机重启保存、CPU五模式各两局；正常网页选择/拒绝隔离/键鼠/刷新重启/1080p4K；双网页AI沿普通输入自然两局/原Effect11与GA15/迷彩/实例声音归零和重启库存快捷槽/控制恢复。

原和业务结果为engineering-owned-equipment-boundary-{evidence,rules,types,boundaries}.log；原装备record/batch与pair/receive五命令、账户记录/装备profile/210来源绑定/96base重算与技能/112迷彩规则、类型/218运行边界通过。PtlOwnedRoles及schema SHA不变，294发行JS/map排除原字段表与三个decoder、编译网络保存/五模式各两局及网页正常选择1080p4K通过（engineering-owned-equipment-boundary-{protocol,server-build,artifacts,compiled,roles-browser}.log）。Web独立构建通过（engineering-owned-equipment-boundary-web-build.log）；双网页AI自然两局72605/91046ms、原Effect11/GA15/拥有迷彩、双方退出instances/voices归零及重启库存快捷槽/控制恢复通过（engineering-owned-equipment-boundary-two-rounds.log、engineering-owned-equipment-boundary-browser.log及独立engineering-owned-equipment-boundary-browser.json）。全部本片检查退出0，临时服务/Vite/Chromium已关闭。此片只证明职责分离与现有链回归；全部资产、原技能/玩法及高清全内容联机性能继续按tasklist对应任务恢复。
