# 首件付费战车购买来源

首件目录采用原战车3“游骑兵”：`tankshop` 金钱价2500、代币价250，购买方式2，默认 U/M/XY 为30041/30042/30013，耐久度默认3，三个赠品均0。战车1两价均0；战车2没有 tankshop 记录，不能凭 tank 基础表补造商城可售记录。战车3属于正式21战车支持集合，适合首件付费购买闭环；开放这一辆的商城范围及购买建档是重建服务端策略。

## 可直接使用的配置

| 原配置 | 战车3值 | 单位/用途 |
| --- | ---: | --- |
| 坦克金钱价 | 2500 | 整数金钱单位，无百分比或倍率 |
| 坦克代币价 | 250 | 整数代币单位 |
| 购买方式 | 2 | 原购买分支选择金钱价；值1分支比较代币价 |
| 默认贴图(炮塔) | 30041 | tanktexture ID，003U_004.tga |
| 默认贴图(车身) | 30042 | tanktexture ID，003M_004.tga |
| 默认贴图(履带) | 30013 | tanktexture ID，003XY_001_A.tga |
| 耐久度默认 | 3 | 原配置整数；其拥有记录字段映射未恢复 |
| TankAtk / TankAtkBonus | 122 / 78 | 原基础表整数；拥有记录对应攻值/额外攻值消费者 |
| TankDef / TankDefBonus | 17 / 44 | 原基础表整数；拥有记录对应防值/额外防值消费者 |
| TankPartSlot | 2 | 原基础表部件数量；拥有+6c初值producer未恢复 |

`0x494036–0x4940db` 原商城请求查询 tankshop 后，购买方式2比较资料selector7与表+20金钱价，方式1比较selector26与表+1c代币价；成功发送购买请求。此客户端分支不证明余额扣款或建档已成功。首件若允许代币购买，应明确这是重建购买选项，不能把表中有代币价格解释为方式2自动允许两币种。

现有账户商店读取持久 profile+70/+74 的金钱/代币并在SQLite事务内扣款，但只创建 `inventory` 道具记录。战车应创建 `role_records.kind=equipment` 记录；不能把 tank3 的定义3塞到 ItemTableID=3，道具3另是宠物注射剂。

## 拥有记录与正式选择的已证字段

| 字段 | 宽度 | 确定含义 |
| --- | ---: | --- |
| +1c | uint32 | 拥有实例键；由重建事务分配，不等于战车定义 |
| +24 | uint32 | TankTable定义ID，首件为3 |
| +28 / +2c / +30 | 各uint32 | 已选U/M/XY表ID；购买默认填30041/30042/30013是明确重建建档赋值 |
| +3c / +40 | 各uint16线路，DWORD存储 | 攻值/额外攻值消费者；原表122/78可作为重建未强化赋值 |
| +4c / +50 | 各uint16线路，DWORD存储 | 防值/额外防值消费者；原表17/44可作为重建未强化赋值 |
| +34 | uint32 | 为0时原重算把四精通减1并最低1；未知购买初值/业务名称 |
| +58 / +5c / +60 | 各uint32 | 三个固定物件定义ID；非零占用部件槽 |
| +6c | 6位线路，DWORD存储 | 固定物件前的槽容量；购买初值producer未恢复 |

完整原reader还保留+68/+64/+20的uint32，+44/+54的uint16，+38/+48的1位字段。所有21字段集合及线路顺序以唯一 `recovery/evidence/roles/role-owned-equipment.ts` 为准；不根据夹具给未知字段发明语义。

正式可复用入口：`AccountStore.roleRecords/replaceRoleRecords` 保存完整字段；`resolveOwnedRoleTank` 按实例查+24；`readOwnedTankTextures` 读取三个槽；SelectRole使用实例ID写profile+a8；房间来源从持久拥有记录读定义、复制记录并正式重算。原拥有消息/保存/选择/纹理既有证据见account-inventory.md、owned-tank-textures-sol.md、engineering-owned-equipment-boundary.md；本轮没有重跑这些native。

## 空构造与购买建档的边界

原客户端 `0x421ec2` 构造完整70hex字节拥有装备记录：字符串通过405805初始化，+1c/+20/+24/+34/+38/+3c/+40/+44/+48/+4c/+50/+54/+64/+68/+6c逐项清0，+28的12字节由57a8d0清0，+58/+5c/+60由三个stosd清0。既有 `role-owned-equipment-native.py` 与原3aa5配对reader执行了该构造，然后由421afe覆盖服务器发送字段。

生产没有可直接复用的“原购买战车构造函数”。`readOwnedRoleEquipmentRecord` 是取证解码函数，不能作为生产建档工厂依赖；`record-defaults.ts` 构造的是战斗角色数字记录，也不能替代拥有战车记录。实现可用唯一 OwnedRoleEquipmentRecord 契约显式创建重建购买记录，保持完整21字段、uint32存储与名称；空构造的清0只证明客户端初始化，并不证明服务器将哪些零保留到购入记录。购买需要的实例/定义/默认纹理与未强化四攻防值有直接配置和消费者，其他初值必须在实现中明确为重建策略。

## 关键来源缺口

原购买成功服务器 producer 未恢复，不能提供全数值原购买模板。尤其耐久默认3到拥有字段的映射、+34购买初值、+6c从TankPartSlot复制，以及未知字段成功值均缺来源。`specialtank` 有独立定义/原型/三纹理配置，本轮首件普通tank3不消费它，不推定特殊战车转换。首件若继续实现，使用明确重建未强化记录政策，并把原server初值验收保留未完成；不要把过去tank1/pet1显式fixture的全0字段称作购买初值。

静态来源提取：`recovery/.venv/bin/python tests/tank-purchase-source-sol.py`，输出 `recovery/output/tank-purchase-source-sol.json`。脚本仅保存原tank3/shop/texture行和tank1/2候选情况，不执行native、账户修改或全量恢复。
