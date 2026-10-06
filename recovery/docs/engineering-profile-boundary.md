# 角色 profile 的账户执行与原程序取证边界

E-04本片贯穿实际账户 profile→装备/外观读写→房间准备与拥有部件来源→对局属性，同时保留原程序确认/更新对照。角色 profile 内部类型与真正跨端协议不同：RoleProfilePayload使用Uint8Array，只被服务端账户和对局使用；PtlRoleProfile/PtlEquipment传number[]及strings。不能把内部类型引用当作共同执行规则。

| 所有者 | 模块 | 实际职责 |
|---|---|---|
| server/accounts/profile | payload.ts | 唯一RoleProfilePayload，保留原字节与独立两字符串 |
| server/accounts/profile | equipment.ts | 原selector2五槽读写，只修改payload+148的20字节 |
| server/accounts/profile | cosmetics.ts | 原selector44/array1外观读写，保留尾两项及其他字段 |
| recovery/evidence/roles | role-profile-confirmation.ts | 原4249b6/424908/4209fb成功复制门槛及通知顺序，仅CTS执行 |
| recovery/evidence/roles | role-profile-update.ts、role-profile-update-wire.ts | 原profile读取、3aac更新分支与原包体，仅CTS执行 |
| shared/protocols | PtlRoleProfile、PtlEquipment | 既有双端number[]/strings协议，保持不变 |

AccountStore、World、battle/preparation及battle-role-sources已直接消费新账户模块；实际账户装备保存、角色重新绑定、拥有部件与外观来源构造继续沿原链。源角色/profile数据复制与对局冻结行为不改。旧shared五文件已删除，没有转发壳或副本。其他仅服务端拥有来源/选择/战斗计算规则继续由后续E-04真实业务切片迁移，整体E-04尚未完成。

原confirmation/update/update-wire/cosmetics四组native与CTS归evidence/roles。Native ROOT按新目录parents[3]解析，原oracle输出路径不变；update-wire native仍先读取update native结果，所以命令顺序保留。test:combat:profile、test:combat:health、test:combat:equipment改用新取证入口；实际账户/属性CTS仍在tests并直接消费生产模块，profile原包对照调用独立evidence模块。生产不执行原二进制或取证算法。

## 原规则与账户验收

8个原native/CTS命令通过：48原确认的选择性字段复制及callback顺序、96完整原位读取/264更新分支、384原3aac envelope、32原外观读写。字段、位型、copy范围、未传输内存和字符串存储保持不变；这些原listener/codec不证明完整原服务器确认策略。

4个实际业务CTS通过：24原profile更新保存/重开/隔离/CLI导入，账户部件装备的资格/移动替换/拒绝无写入/20字节profile/标记/重启，32原profile源向量到拥有来源的分离/准备/冻结/再战/清理，126原完整属性与21战车普通默认弹药/生命。检查能发现模块搬迁后来源对象、字段写入及跨局生命周期断链。

证据：engineering-profile-boundary-evidence.log、engineering-profile-boundary-rules.log。全仓npx tsc --noEmit与218可达正式模块依赖检查通过（engineering-profile-boundary-types.log、engineering-profile-boundary-boundaries.log），运行不导入evidence/tests/tools。

## 集成验收条件

- PtlRoleProfile/PtlEquipment与serviceProto SHA保持一致，本片不需生成新协议。
- 两端独立构建；发行JS/map排除原confirmation/update/wire，账户与battle-role-sources实际引用新的equipment/cosmetics实现。
- 编译服务实际账户/装备/profile联机及重启保存、五模式CPU各两局/冻结结算/再战/清房。
- 正常网页战车/宠物与装备选择/取消/拒绝/隔离/刷新重启、1080p/4K原界面及预览释放。
- 双网页账户AI沿普通输入自然连续两局/治疗Effect11与GA15/拥有迷彩、退出资源声音清理、服务重启库存快捷槽与控制恢复。

协议文件SHA一致；两端独立构建、300发行JS/map取证排除/实际账户和来源引用、编译账户重启保存/五模式各两局、正常网页战车宠物/装备键鼠操作及拒绝/隔离/刷新重启/1080p4K已通过（engineering-profile-boundary-{protocol,server-build,web-build,artifacts,compiled,roles-browser,equipment-browser}.log）。双网页AI自然两局48974/115846ms、原Effect11/GA15/拥有迷彩、双方退出instances/voices归零及重启库存快捷槽/控制恢复通过（engineering-profile-boundary-two-rounds.log、engineering-profile-boundary-browser.log及独立engineering-profile-boundary-browser.json）。所有本片检查退出0，临时服务/Vite/Chromium已关闭。原界面高清页面检查与降低画布分辨率的自然两局分别证明对应行为，不宣称高清全内容性能或全部原技能已经恢复。
