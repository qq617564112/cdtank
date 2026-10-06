# 拥有来源接收与原消息解码边界

E-04本片沿AccountStore已选拥有来源→World绑定→BattleRoleSources引用接收/复制冻结→房间和对局快照整理真实执行所有权。RoleOwnedSources内部使用Map记录，正式只有服务端消费；真正PtlOwnedRoles传数组字段数据，与内部记录不同，本片协议及schema不改。

| 所有者 | 模块 | 实际职责 |
|---|---|---|
| server/accounts/owned | receive-pair.ts | 唯一RoleOwnedSources与receiveRoleOwnedPair；原422f66顺序赋值保留消息引用 |
| recovery/evidence/roles | role-owned-sources.ts | 原3aa5成对记录读取、3aab批次与附加字节读取，仅取证与显式测试seed |
| server | AccountStore、World、BattleRoleSources、battle/preparation、rooms/snapshot | 消费唯一内部来源契约；BattleRoleSources实际调用生产receiver |
| shared/protocols | PtlOwnedRoles | 真正双端拥有记录数组契约，保持原样 |

原shared/role-owned-sources入口删除，没有副本或转发。两个解码函数仅被CTS、账户/纹理网络fixture及四个browser fixture用于原来源显式导入，所有消费者改用evidence。底层owned base/equipment记录目前仍被shared重算/技能/定义/纹理算法使用，本片不搬整个簇，也不让shared反向依赖server。AccountStore与真实对局无需执行原消息decoder。

原pair/receive两组native与CTS迁evidence/roles，ROOT按新目录parents[3]解析，原oracle路径不变；pair native仍runpy原recovery/evidence/roles/role-owned-equipment-native.py，依赖本片未迁移的底层record原程序执行。对应test:combat:health入口改用迁移路径；CTS分别调用evidence解码和真实server receiver。

## 验收条件

- 原pair位流、记录构造与顺序、原listener/typegetter/调用与引用身份保持；函数体不变。
- 账户profile/拥有记录保存重启/隔离/显式CLI、实际账户来源到World属性绑定/首局再战冻结/未知实例拒绝；批次容量/重复/附加字节、原完整重算接线。
- 全仓类型及正式依赖检查，PtlOwnedRoles及serviceProto SHA不变；两端独立构建，发行JS/map排除pair/batch decoder并保留BattleRoleSources真实receiver调用。
- 编译服务账户/迷彩网络重启保存和CPU五模式各两局；正常网页选车宠物/键鼠/拒绝隔离/刷新重启及1080p4K；双网页账户AI沿普通输入自然两局/治疗Effect11与GA15/拥有迷彩、退出实例声音清理/重启库存快捷槽与控制恢复。

原和业务证据：engineering-owned-receive-boundary-{evidence,rules,types,boundaries}.log；原16配对/23listener与16接收引用、账户profile/record持久化与210来源绑定、96record/5批次/3容量门槛、564重算/254缺来源与16消息到完整属性、类型/218运行边界全部通过。协议SHA不变，两端构建及294发行JS/map排除两原decoder、编译保存/五模式两局与正常选车宠物页面1080p4K通过（engineering-owned-receive-boundary-{protocol,server-build,web-build,artifacts,compiled,roles-browser}.log）。双网页AI自然两局47579/111330ms、原Effect11/GA15/拥有迷彩、双方退出instances/voices归零及服务重启库存快捷槽/控制恢复全部通过（engineering-owned-receive-boundary-two-rounds.log、engineering-owned-receive-boundary-browser.log及独立engineering-owned-receive-boundary-browser.json）。全部本片执行检查退出0，临时服务/Vite/Chromium已关闭。本片只证明职责与现有业务回归，不证明完整原服务器消息封装、认证、技能或高清全内容性能。
